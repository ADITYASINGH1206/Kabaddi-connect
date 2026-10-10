"""Regression tests for bugs found in the pre-submission review."""

import importlib.util
import os
import unittest
from decimal import Decimal
from pathlib import Path
from unittest import mock

from boto3.dynamodb.types import TypeSerializer

from backend.common import db
from backend.common.matching import get_ewaste_drop_points
from backend.functions.impact import handler as impact_handler

ROOT = Path(__file__).resolve().parents[2]


class FakeTable:
    def __init__(self, items=None):
        self.put_items = []
        self._items = items or []

    def put_item(self, Item):
        self.put_items.append(Item)

    def scan(self, **kwargs):
        return {"Items": self._items}


class FakeResource:
    def __init__(self, table):
        self._table = table

    def Table(self, name):
        return self._table


class CacheWriteTests(unittest.TestCase):
    def test_cached_analysis_is_dynamodb_serialisable(self):
        """boto3 rejects Python floats; the cache write used to fail silently."""
        table = FakeTable()
        analysis = {
            "photo_quality_ok": True,
            "items": [{"material": "cardboard", "weight_kg_low": 1.5, "weight_kg_high": 2.5, "confidence": 0.9}],
            "hazards": [],
        }
        with mock.patch.object(db, "get_dynamodb_resource", return_value=FakeResource(table)):
            db.save_cached_analysis("abc123", analysis)
        self.assertEqual(len(table.put_items), 1)
        item = table.put_items[0]
        TypeSerializer().serialize(item)  # raises TypeError if a float is left in
        self.assertIsInstance(item["analysis"]["items"][0]["confidence"], Decimal)

    def test_cache_item_does_not_write_createdat(self):
        """createdAt is a String GSI key; a numeric value there is rejected by DynamoDB."""
        table = FakeTable()
        with mock.patch.object(db, "get_dynamodb_resource", return_value=FakeResource(table)):
            db.save_cached_analysis("abc123", {"items": []})
        self.assertNotIn("createdAt", table.put_items[0])
        self.assertIn("cachedAt", table.put_items[0])


class EwasteDropOffTests(unittest.TestCase):
    def test_reads_drop_off_points_from_dynamodb_when_configured(self):
        points = [{"id": "ewaste-002", "name": "B"}, {"id": "ewaste-001", "name": "A"}]
        with mock.patch.dict(os.environ, {"LISTINGS_TABLE": "t"}), \
                mock.patch.object(db, "get_ewaste_points_from_db", return_value=points):
            result = get_ewaste_drop_points()
        self.assertEqual([p["id"] for p in result], ["ewaste-001", "ewaste-002"])

    def test_falls_back_to_seed_file_if_dynamodb_fails(self):
        with mock.patch.dict(os.environ, {"LISTINGS_TABLE": "t"}), \
                mock.patch.object(db, "get_ewaste_points_from_db", side_effect=RuntimeError("down")):
            result = get_ewaste_drop_points()
        self.assertTrue(len(result) >= 1)  # seed/ewaste_points.json
        self.assertFalse(any(p.get("verified") for p in result))


class ImpactHonestyTests(unittest.TestCase):
    def _run(self, completed):
        table = FakeTable(items=completed)
        with mock.patch.object(impact_handler, "get_dynamodb_resource", return_value=FakeResource(table)):
            resp = impact_handler.lambda_handler({}, None)
        import json
        return json.loads(resp["body"])

    def test_no_accuracy_figure_without_live_pickups(self):
        body = self._run([])
        self.assertIsNone(body["weight_estimation_mape_pct"])
        self.assertEqual(body["weight_estimation_sample_size"], 0)
        self.assertTrue(body["km_saved_is_demo_baseline"])

    def test_accuracy_comes_only_from_live_pickups(self):
        live = [
            {"status": "COMPLETED", "payout": Decimal("100"), "estimateErrorPct": Decimal("10"),
             "actualItems": [{"material": "cardboard", "actual_kg": Decimal("4")}]},
            {"status": "COMPLETED", "payout": Decimal("50"), "estimateErrorPct": Decimal("20"),
             "actualItems": [{"material": "cardboard", "actual_kg": Decimal("2")}]},
        ]
        body = self._run(live)
        self.assertEqual(body["weight_estimation_mape_pct"], 15.0)
        self.assertEqual(body["weight_estimation_sample_size"], 2)
        self.assertEqual(body["live_pickups_count"], 2)

    def test_seeded_pickups_do_not_feed_accuracy_and_split_metrics(self):
        records = [
            # Seeded demo pickup with an error
            {"status": "COMPLETED", "payout": Decimal("500"), "estimateErrorPct": Decimal("8.5"),
             "seeded": True, "actualItems": [{"material": "newspaper_paper", "actual_kg": Decimal("25")}]},
            # Live pickup with an error
            {"status": "COMPLETED", "payout": Decimal("120"), "estimateErrorPct": Decimal("5.0"),
             "seeded": False, "actualItems": [{"material": "cardboard", "actual_kg": Decimal("10")}]},
        ]
        body = self._run(records)
        self.assertEqual(body["seeded_pickups_count"], 1)
        self.assertEqual(body["live_pickups_count"], 1)
        self.assertEqual(body["pickups_completed"], 2)
        self.assertEqual(body["seeded_payout_inr"], 500.0)
        self.assertEqual(body["live_payout_inr"], 120.0)
        self.assertEqual(body["collector_income_facilitated_inr"], 620.0)
        self.assertEqual(body["seeded_kg_diverted"], 25.0)
        self.assertEqual(body["live_kg_diverted"], 10.0)
        self.assertEqual(body["total_kg_diverted"], 35.0)
        # Crucial honesty rule: only live error (5.0%) is used, seeded (8.5%) is ignored
        self.assertEqual(body["weight_estimation_mape_pct"], 5.0)
        self.assertEqual(body["weight_estimation_sample_size"], 1)


class SeedTableLookupTests(unittest.TestCase):
    def _load_seed(self):
        spec = importlib.util.spec_from_file_location("seed_mod", ROOT / "seed" / "seed.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_resolves_generated_table_names_from_stack(self):
        seed = self._load_seed()
        page = {"StackResourceSummaries": [
            {"LogicalResourceId": "RatesTable", "ResourceType": "AWS::DynamoDB::Table", "PhysicalResourceId": "kc-RatesTable-X"},
            {"LogicalResourceId": "CollectorsTable", "ResourceType": "AWS::DynamoDB::Table", "PhysicalResourceId": "kc-CollectorsTable-Y"},
            {"LogicalResourceId": "ListingsTable", "ResourceType": "AWS::DynamoDB::Table", "PhysicalResourceId": "kc-ListingsTable-Z"},
            {"LogicalResourceId": "PickupsTable", "ResourceType": "AWS::DynamoDB::Table", "PhysicalResourceId": "kc-PickupsTable-W"},
            {"LogicalResourceId": "HealthFunction", "ResourceType": "AWS::Lambda::Function", "PhysicalResourceId": "fn"},
        ]}
        client = mock.Mock()
        client.get_paginator.return_value.paginate.return_value = [page]
        with mock.patch.object(seed.boto3, "client", return_value=client):
            resolved = seed.resolve_tables_from_stack("ap-southeast-2", "kabadiconnect")
        self.assertEqual(resolved, {
            "rates_table": "kc-RatesTable-X",
            "collectors_table": "kc-CollectorsTable-Y",
            "listings_table": "kc-ListingsTable-Z",
            "pickups_table": "kc-PickupsTable-W",
        })

    def test_returns_empty_when_stack_unreadable(self):
        seed = self._load_seed()
        with mock.patch.object(seed.boto3, "client", side_effect=RuntimeError("no creds")):
            self.assertEqual(seed.resolve_tables_from_stack("ap-south-1", "nope"), {})


if __name__ == "__main__":
    unittest.main()
