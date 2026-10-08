import type { Language } from '../types';

export const translations = {
  en: {
    appTitle: 'KabadiConnect',
    tagline: 'AI-powered fair prices for informal recycling',
    rolePrompt: 'Choose your role to get started',
    roleHousehold: 'I have scrap to sell',
    roleHouseholdSub: 'Households, shops, hostels seeking fair instant estimates',
    roleCollector: 'I collect scrap (कबाड़ी)',
    roleCollectorSub: 'Informal collectors seeking clustered leads & route optimization',
    indicativeNotice: 'Rates are indicative based on local market averages. Collector will verify weight on pickup.',
    
    // Snap Screen
    snapTitle: 'Photograph Your Scrap',
    snapSubtitle: 'Place all items in good light. Our Bedrock Vision AI identifies materials and estimates weight ranges.',
    takePhoto: 'Take Photo / Choose File',
    uploadingPhoto: 'Preparing & compressing image...',
    analyzingScrap: 'AI is inspecting your scrap...',
    analyzingHint: 'Estimating weight bands and checking for toxic e-waste hazards...',
    
    // Review Screen
    reviewTitle: 'Review Scrap Estimate',
    estimatedValue: 'Estimated Total Value',
    materialsFound: 'Materials Detected',
    addMaterial: '+ Add Another Material',
    retakePrompt: 'Photo quality needs improvement',
    retakeAction: 'Retake Photo',
    hazardBannerTitle: 'Hazardous Waste Flagged',
    hazardBannerDesc: 'Hazardous items require certified handling. They cannot be sold to general informal scrap collectors.',
    sliderLabel: 'Your Estimated Weight:',
    confidence: 'AI Confidence',
    indicativeRateLabel: 'Rate Band',
    proceedToPickup: 'Proceed to Pickup Details',
    back: 'Back',
    retry: 'Retry',
    emptyListWarning: 'Please add at least one material to proceed.',
    manualAddTitle: 'Select material to add',
    cancel: 'Cancel',
    add: 'Add',
    offlineDemoMode: 'Demo / Offline fallback active',
  },
  hi: {
    appTitle: 'कबाड़ी कनेक्ट',
    tagline: 'कबाड़ का सही दाम, सीधे आपके घर तक',
    rolePrompt: 'शुरुआत करने के लिए अपनी भूमिका चुनें',
    roleHousehold: 'मुझे कबाड़ बेचना है',
    roleHouseholdSub: 'घर, दुकान व हॉस्टल - तुरंत सही दाम और पिकअप पाएं',
    roleCollector: 'मैं कबाड़ इकट्ठा करता हूँ (कबाड़ी)',
    roleCollectorSub: 'आस-पास के आर्डर, सही रूट और बेहतर कमाई पाएं',
    indicativeNotice: 'ये दरें सांकेतिक हैं। कबाड़ी भाई पिकअप के समय सही वजन जांचेंगे।',
    
    // Snap Screen
    snapTitle: 'कबाड़ की फोटो खींचें',
    snapSubtitle: 'कबाड़ को रोशनी में रखें। हमारा AI मॉडल सामग्री पहचानकर सही दाम का अनुमान लगाएगा।',
    takePhoto: 'फोटो खींचें या अपलोड करें',
    uploadingPhoto: 'फोटो तैयार की जा रही है...',
    analyzingScrap: 'AI आपके कबाड़ का आकलन कर रहा है...',
    analyzingHint: 'सामग्री, अनुमानित वजन और ई-कचरे की जांच जारी है...',
    
    // Review Screen
    reviewTitle: 'कबाड़ की जांच और अनुमान',
    estimatedValue: 'कुल अनुमानित मूल्य',
    materialsFound: 'पहचानी गई सामग्री',
    addMaterial: '+ अन्य सामग्री जोड़ें',
    retakePrompt: 'फोटो साफ नहीं आई',
    retakeAction: 'दोबारा फोटो लें',
    hazardBannerTitle: 'सावधानी: खतरनाक कचरा मिला',
    hazardBannerDesc: 'खतरनाक सामग्री को अधिकृत केंद्र पर देना आवश्यक है। इसे सामान्य कबाड़ी नहीं ले सकते।',
    sliderLabel: 'आपका अनुमानित वजन:',
    confidence: 'AI भरोसा',
    indicativeRateLabel: 'अनुमानित दर',
    proceedToPickup: 'पिकअप की तारीख व पता चुनें',
    back: 'वापस',
    retry: 'पुनः प्रयास',
    emptyListWarning: 'आगे बढ़ने के लिए कम से कम एक सामग्री जोड़ें।',
    manualAddTitle: 'सामग्री चुनें',
    cancel: 'रद्द करें',
    add: 'जोड़ें',
    offlineDemoMode: 'डेमो / बैकअप मोड सक्रिय',
  }
};

export const getTranslation = (lang: Language) => translations[lang];
