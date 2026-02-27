import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  MapPin,
  Building2,
  Plane,
  Car,
  Star,
  UtensilsCrossed,
  Sun,
  Clock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { useTripContext } from '../context/TripContext';
import type { TripDay, Hotel, Flight, DrivingSegment, Highlight, Restaurant } from '../types/trip';

// ─── Curated Greece itinerary suggestions ────────────────────────────────────
// Used as fallback/supplement when Firebase data has no entries for a day.

interface DaySuggestion {
  title: string;
  titleHe: string;
  location: string;
  locationHe: string;
  morning: string[];
  morningHe: string[];
  afternoon: string[];
  afternoonHe: string[];
  evening: string[];
  eveningHe: string[];
  restaurants: string[];
  restaurantsHe: string[];
  tips: string;
  tipsHe: string;
}

const GREECE_SUGGESTIONS: DaySuggestion[] = [
  {
    title: 'Arrival in Athens',
    titleHe: 'הגעה לאתונה',
    location: 'Athens',
    locationHe: 'אתונה',
    morning: ['Flight arrival at Athens International Airport (ATH)', 'Car rental pickup', 'Transfer to hotel'],
    morningHe: ['נחיתה בנמל התעופה הבינלאומי של אתונה', 'איסוף רכב שכור', 'נסיעה למלון'],
    afternoon: ['Check in & freshen up', 'First stroll around Syntagma Square', 'Visit the National Garden'],
    afternoonHe: ['צ\'ק-אין והתאוששות', 'טיול ראשוני בכיכר סינטגמה', 'ביקור בגן הלאומי'],
    evening: ['Dinner in Monastiraki or Plaka neighbourhood', 'Evening walk near Acropolis illumination'],
    eveningHe: ['ארוחת ערב בשכונת מונסטירקי או פלקה', 'טיול ערב ליד האקרופוליס המואר'],
    restaurants: ['Tzitzikas kai Mermingas (Monastiraki)', 'Diporto Agoras (traditional)', 'Avli (Plaka)'],
    restaurantsHe: ['ציצקס קאי מרמינגס (מונסטירקי)', 'דיפורטו אגוראס (מסורתי)', 'אוולי (פלקה)'],
    tips: 'Get an Oyster card for Athens Metro – it covers bus and metro rides.',
    tipsHe: 'קנו כרטיס Oyster לרכבת האוויר של אתונה – הוא מכסה אוטובוסים ומטרו.',
  },
  {
    title: 'Acropolis & Ancient Agora',
    titleHe: 'האקרופוליס ואגורה העתיקה',
    location: 'Athens',
    locationHe: 'אתונה',
    morning: ['Acropolis Hill (Parthenon, Erechtheion, Propylaea)', 'Acropolis Museum at the base', 'Beat the crowds – arrive before 9:00 am'],
    morningHe: ['גבעת האקרופוליס (פרתנון, ארקתיון, פרופילאיה)', 'מוזיאון האקרופוליס בתחתית הגבעה', 'הגיעו לפני 9:00 בבוקר למנוע עומס'],
    afternoon: ['Ancient Agora of Athens & Temple of Hephaestus', 'Stoa of Attalos Museum', 'Explore Monastiraki flea market'],
    afternoonHe: ['האגורה העתיקה של אתונה ומקדש הפאיסטוס', 'מוזיאון הסטואה של אטלוס', 'שוק הפשפשים מונסטירקי'],
    evening: ['Sunset view from Lycabettus Hill', 'Dinner in Kolonaki neighbourhood'],
    eveningHe: ['שקיעה מגבעת לוקבטוס', 'ארוחת ערב בשכונת קולונקי'],
    restaurants: ['Το Καφεδάκι (local mezze)', 'Varoulko Seaside (seafood)', 'Nolan (modern Greek)'],
    restaurantsHe: ['טו קפדקי (מזה מקומי)', 'ורולקו (פירות ים)', 'נולן (יווני מודרני)'],
    tips: 'The combined Acropolis ticket covers 7 archaeological sites for €30. Book online to skip queues.',
    tipsHe: 'כרטיס משולב לאקרופוליס מכסה 7 אתרים ארכיאולוגיים ב-€30. הזמינו אונליין לדילוג על תורים.',
  },
  {
    title: 'Day Trip to Cape Sounion & Delphi Route',
    titleHe: 'טיול יום לקייפ סוניון ודרך לדלפי',
    location: 'Athens → Cape Sounion → Delphi',
    locationHe: 'אתונה → קייפ סוניון → דלפי',
    morning: ['Drive to Cape Sounion (70 km south of Athens)', 'Temple of Poseidon – stunning cliff-top ruins', 'Swim at Sounion beach if weather allows'],
    morningHe: ['נסיעה לקייפ סוניון (70 ק"מ דרומית לאתונה)', 'מקדש פוסידון – חורבות מרהיבות על צוק', 'שחייה בחוף סוניון אם מזג האוויר מאפשר'],
    afternoon: ['Drive north to Delphi (180 km, ~2.5 hrs via E75/E65)', 'Check into Arachova or Delphi hotel', 'Stroll Delphi town or Arachova village shops'],
    afternoonHe: ['נסיעה צפונה לדלפי (180 ק"מ, ~2.5 שעות)', 'צ\'ק-אין במלון', 'טיול בעיירת דלפי או בחנויות כפר ארכובה'],
    evening: ['Dinner in Arachova (excellent lamb dishes)', 'Stargaze – Parnassos has very clear skies'],
    eveningHe: ['ארוחת ערב בארכובה (כבש מצוין)', 'תצפית כוכבים – שמיים בהירים מאוד מהר פרנסוס'],
    restaurants: ['Kaplanis (Arachova)', 'Taverna Vakhos (Delphi)', 'Pita Souvlaki local spots'],
    restaurantsHe: ['קפלאניס (ארכובה)', 'טברנה וכוס (דלפי)', 'פיתה סובלאקי מקומיים'],
    tips: 'Arachova ski gear shops rent equipment for Parnassos. Book ski tickets in advance on weekends.',
    tipsHe: 'חנויות ציוד סקי בארכובה מושכרות ציוד לפרנסוס. הזמינו כרטיסי סקי מראש בסופי שבוע.',
  },
  {
    title: 'Delphi Archaeological Site & Parnassos Skiing',
    titleHe: 'אתר הדלפי ארכיאולוגי וסקי בפרנסוס',
    location: 'Delphi / Arachova',
    locationHe: 'דלפי / ארכובה',
    morning: ['Delphi Archaeological Site – Oracle sanctuary, Temple of Apollo, Tholos', 'Delphi Archaeological Museum (must-see Charioteer statue)', 'Visit the Castalian Spring'],
    morningHe: ['אתר דלפי – מקדש אפולו, תולוס, מקדש האורקל', 'מוזיאון דלפי הארכיאולוגי (חובה – פסל הרכב)', 'ביקור במעיין הקסטאלי'],
    afternoon: ['Drive 30 min to Parnassos Ski Center (Kelaria or Fterolakka)', 'Ski or snowboard on Greece\'s largest ski resort', 'Ski lessons available for beginners & kids'],
    afternoonHe: ['נסיעה 30 דקות למרכז הסקי פרנסוס', 'סקי או סנובורד באתר הסקי הגדול ביוון', 'שיעורי סקי זמינים למתחילים וילדים'],
    evening: ['Return to Arachova for dinner', 'Try local cheeses: Formaella & Katiki'],
    eveningHe: ['חזרה לארכובה לארוחת ערב', 'נסו גבינות מקומיות: פורמאלה וקטיקי'],
    restaurants: ['Taverna Dasargiris (Arachova)', 'Restaurant Karaolos', 'Mountain Coffee & Meze bars'],
    restaurantsHe: ['טברנה דסרגיריס (ארכובה)', 'מסעדת קראולוס', 'ברי קפה ומזה הרים'],
    tips: 'Parnassos Ski Center has ~36 runs from 1,600–2,260m. Equipment rental ~€20/day. Check snow conditions at snow-forecast.com.',
    tipsHe: 'מרכז הסקי פרנסוס כולל ~36 מסלולים ב-1,600–2,260 מ\'. השכרת ציוד ~€20/יום.',
  },
  {
    title: 'Drive to Meteora',
    titleHe: 'נסיעה למטאורה',
    location: 'Arachova → Meteora (Kalambaka)',
    locationHe: 'ארכובה → מטאורה (קלמבקה)',
    morning: ['Scenic drive through central Greece (~3 hrs)', 'Stop at Lake Plastiras viewpoint', 'Arrive in Kalambaka & check in'],
    morningHe: ['נסיעה ציורית דרך יוון המרכזית (~3 שעות)', 'עצירה בנקודת תצפית אגם פלסטירה', 'הגעה לקלמבקה וצ\'ק-אין'],
    afternoon: ['Explore Kalambaka town & Kastráki village', 'First view of the stunning rock formations', 'Hike the Meteora trail for panoramic views'],
    afternoonHe: ['סיור בעיירת קלמבקה וכפר קסטרקי', 'מבט ראשון על הסלעים המרהיבים', 'טיול רגלי במסלול המטאורה לנוף פנורמי'],
    evening: ['Sunset at Holy Trinity Monastery viewpoint', 'Dinner in Kalambaka – try local pies'],
    eveningHe: ['שקיעה בנקודת תצפית מנזר הולי טריניטי', 'ארוחת ערב בקלמבקה – נסו פשטידות מקומיות'],
    restaurants: ['Restaurant Meteora (Kalambaka)', 'Taverna Gardenia', 'Paradisos Restaurant'],
    restaurantsHe: ['מסעדת מטאורה', 'טברנה גרדניה', 'מסעדת פרדיסוס'],
    tips: 'Meteora monasteries require covered shoulders & knees. Each charges ~€3 entry. Best light for photos is early morning.',
    tipsHe: 'מנזרי מטאורה דורשים לבוש צנוע. כניסה ~€3 לכל מנזר. האור הטוב לצילום הוא בבוקר מוקדם.',
  },
  {
    title: 'Meteora Monasteries',
    titleHe: 'מנזרי המטאורה',
    location: 'Meteora',
    locationHe: 'מטאורה',
    morning: ['Great Meteoron Monastery (largest, most impressive)', 'Varlaam Monastery (excellent frescoes)', 'Roussanou Monastery (built on sheer cliff)'],
    morningHe: ['מנזר גדול מטאורון (הגדול והמרשים ביותר)', 'מנזר ורלאם (פרסקות מצוינות)', 'מנזר רוסאנו (בנוי על צוק תלול)'],
    afternoon: ['Holy Trinity Monastery (Indiana Jones filming location!)', 'St. Stephen\'s Monastery (easy access)', 'Panoramic viewpoints between each monastery'],
    afternoonHe: ['מנזר הולי טריניטי (אתר צילום של אינדיאנה ג\'ונס!)', 'מנזר סנט סטיבן (גישה קלה)', 'נקודות תצפית פנורמיות בין המנזרים'],
    evening: ['Sunset from the main Meteora overlook', 'Relaxed dinner in Kalambaka'],
    eveningHe: ['שקיעה מנקודת התצפית המרכזית', 'ארוחת ערב נינוחה בקלמבקה'],
    restaurants: ['Taverna Bakaliarakia', 'Lithos Restaurant', 'Meteora Taverna'],
    restaurantsHe: ['טברנה בקליאראקיה', 'מסעדת ליתוס', 'טברנה מטאורה'],
    tips: 'You need at least a full day for all 6 open monasteries. Rent a car or take an organized jeep tour.',
    tipsHe: 'צריך לפחות יום שלם ל-6 המנזרים הפתוחים. השכירו רכב או קחו סיור ג\'יפ מאורגן.',
  },
  {
    title: 'Drive to Thessaloniki or Onwards',
    titleHe: 'נסיעה לתסלוניקי או המשך',
    location: 'Meteora → Thessaloniki',
    locationHe: 'מטאורה → תסלוניקי',
    morning: ['Drive ~3 hrs to Thessaloniki', 'Stop at Thermopylae battle monument', 'Check in to Thessaloniki hotel'],
    morningHe: ['נסיעה ~3 שעות לתסלוניקי', 'עצירה באנדרטת קרב תרמופילאי', 'צ\'ק-אין במלון תסלוניקי'],
    afternoon: ['Walk the Thessaloniki waterfront promenade', 'White Tower – iconic city landmark', 'Aristotle Square & Byzantine Walls'],
    afternoonHe: ['טיול לאורך טיילת החוף של תסלוניקי', 'מגדל הלבן – סמל העיר', 'כיכר אריסטו וחומות ביזנטיות'],
    evening: ['Thessaloniki food scene: best bougatsa & souvlaki in Greece', 'Ladadika neighbourhood bars & tavernas'],
    eveningHe: ['סצנת האוכל של תסלוניקי: הבוגצה והסובלאקי הטובים ביוון', 'ברים וטברנות בשכונת לדדיקה'],
    restaurants: ['Tsinari (mezze)', 'Myrsini (traditional)', 'Aristotelous Cafe (bougatsa)'],
    restaurantsHe: ['צינארי (מזה)', 'מירסיני (מסורתי)', 'קפה אריסטוטלוס (בוגצה)'],
    tips: 'Thessaloniki is Greece\'s food capital. Don\'t miss trigona pastries and koulouri bread from street vendors.',
    tipsHe: 'תסלוניקי היא עיר הקולינריה של יוון. אל תפספסו מאפי טריגונה ולחם קולורי ממוכרי רחוב.',
  },
  {
    title: 'Thessaloniki Highlights',
    titleHe: 'אטרקציות תסלוניקי',
    location: 'Thessaloniki',
    locationHe: 'תסלוניקי',
    morning: ['Archaeological Museum of Thessaloniki (Alexander the Great treasures)', 'Rotunda (Roman mausoleum turned church)', 'Arch of Galerius (Kamara)'],
    morningHe: ['מוזיאון ארכיאולוגי של תסלוניקי (אוצרות אלכסנדר מוקדון)', 'רוטונדה (מאוזוליאום רומי שהפך לכנסייה)', 'קשת גלריוס (קמארה)'],
    afternoon: ['Ano Poli (Upper Town) – Ottoman & Byzantine old town', 'Heptapyrgion Fortress views', 'Jewish Museum of Thessaloniki'],
    afternoonHe: ['אנו פולי (העיר העליונה) – עיר עתיקה עות\'מאנית וביזנטית', 'מבצר הפטפירגיון', 'המוזיאון היהודי של תסלוניקי'],
    evening: ['Sunset at Trigonion Tower', 'Dinner in a seafood restaurant by the port'],
    eveningHe: ['שקיעה ממגדל טריגוניון', 'ארוחת ערב במסעדת פירות ים ליד הנמל'],
    restaurants: ['Mourga (seafood)', 'Zythos (craft beer & meze)', 'I Nea Folia (traditional)'],
    restaurantsHe: ['מורגה (פירות ים)', 'זיטוס (בירה מלאכותית ומזה)', 'אי נה פוליה (מסורתי)'],
    tips: 'Pick up local olive oil, olives, and honey from the Kapani Market (Agora).',
    tipsHe: 'קנו שמן זית, זיתים ודבש מקומיים משוק הקפאני (אגורה).',
  },
  {
    title: 'Travel Day – Flight to Island',
    titleHe: 'יום נסיעה – טיסה לאי',
    location: 'Thessaloniki → Island',
    locationHe: 'תסלוניקי → האי',
    morning: ['Return rental car at airport', 'Domestic flight to Greek island (Santorini/Mykonos/Rhodes)', 'Arrive & check into island hotel'],
    morningHe: ['החזרת רכב שכור בנמל התעופה', 'טיסה פנימית לאי יווני', 'הגעה וצ\'ק-אין במלון האי'],
    afternoon: ['First explore of the island – walk the main village', 'Find the beach for a first swim', 'Explore the caldera views (Santorini) or windmills (Mykonos)'],
    afternoonHe: ['חקירה ראשונה של האי', 'מצאו חוף לשחייה ראשונה', 'נוף הקלדרה (סנטוריני) או טחנות הרוח (מיקונוס)'],
    evening: ['Cliffside dinner with sunset view', 'Try local island specialties'],
    eveningHe: ['ארוחת ערב על צוק עם נוף שקיעה', 'נסו מנות מיוחדות מקומיות של האי'],
    restaurants: ['Ask your hotel for the best local recommendation', 'Look for traditional tavernas away from tourist traps'],
    restaurantsHe: ['שאלו את המלון לגבי ההמלצה המקומית הטובה ביותר', 'חפשו טברנות מסורתיות הרחק מלכודות תיירים'],
    tips: 'Island transport: renting an ATV or quad is popular but a small car is safer for families with kids.',
    tipsHe: 'תחבורה באי: השכרת ATV פופולרית אך מכונית קטנה בטוחה יותר עם ילדים.',
  },
  {
    title: 'Island Day 1 – Beaches & Village',
    titleHe: 'יום 1 באי – חופים וכפר',
    location: 'Greek Island',
    locationHe: 'האי היווני',
    morning: ['Visit the most famous beach (Red Beach/Perissa on Santorini; Paradise/Super Paradise on Mykonos)', 'Snorkeling in crystal clear water', 'Beach cafe breakfast'],
    morningHe: ['ביקור בחוף המפורסם ביותר', 'שנורקלינג במים צלולים', 'ארוחת בוקר בקפה חוף'],
    afternoon: ['Explore the main village (Fira/Oia on Santorini; Mykonos Town)', 'Browse local art galleries & shops', 'Visit a local winery'],
    afternoonHe: ['חקירת הכפר הראשי', 'גלריות אמנות מקומיות וחנויות', 'ביקור ביקב מקומי'],
    evening: ['Famous Santorini/island sunset from Oia or caldera', 'Fine dining with sea views'],
    eveningHe: ['שקיעת השמש המפורסמת מאויה או הקלדרה', 'ארוחת ערב עם נוף לים'],
    restaurants: ['Argo Restaurant Santorini', 'Selene (Santorini)', 'Noam (Mykonos)'],
    restaurantsHe: ['מסעדת ארגו סנטוריני', 'סלני (סנטוריני)', 'נועם (מיקונוס)'],
    tips: 'Book sunset dining tables in Oia at least 3 months in advance in peak season.',
    tipsHe: 'הזמינו שולחנות שקיעה באויה לפחות 3 חודשים מראש בעונת שיא.',
  },
  {
    title: 'Island Day 2 – More Exploration',
    titleHe: 'יום 2 באי – חקירה נוספת',
    location: 'Greek Island',
    locationHe: 'האי היווני',
    morning: ['Rent a car/ATV and drive around the island', 'Visit less-touristy beaches & villages', 'Ancient Akrotiri (Santorini) or Delos island boat trip (Mykonos)'],
    morningHe: ['השכרת רכב/ATV וסיור מסביב לאי', 'חופים וכפרים פחות תיירותיים', 'עיר אקרוטירי העתיקה (סנטוריני) או טיול לאי דלוס (מיקונוס)'],
    afternoon: ['Boat trip or catamaran to volcanic islands/sea caves', 'Hot springs swim (Santorini)', 'Afternoon at a beach club'],
    afternoonHe: ['סיור בסירה לאיי הוולקניים/מערות ים', 'שחייה בבריכות חמות (סנטוריני)', 'אחרי הצהריים בקלאב חוף'],
    evening: ['Wine tasting at an island winery', 'Final island dinner – try fresh grilled fish'],
    eveningHe: ['טעימת יין ביקב האי', 'ארוחת ערב אחרונה באי – נסו דג צלוי טרי'],
    restaurants: ['Santo Wines (Santorini)', 'Local fish taverna by the harbor', 'Psarades (seafood)'],
    restaurantsHe: ['סנטו ויינס (סנטוריני)', 'טברנת דגים מקומית ליד הנמל', 'פסרדס (פירות ים)'],
    tips: 'Fresh fish is always the best order in Greece. Look for the daily catch on a chalkboard menu.',
    tipsHe: 'דג טרי הוא תמיד ההזמנה הטובה ביותר ביוון. חפשו את תפיסת היום על תפריט לוח.',
  },
  {
    title: 'Return to Athens & Departure',
    titleHe: 'חזרה לאתונה והמראה',
    location: 'Island → Athens → Home',
    locationHe: 'האי → אתונה → הבית',
    morning: ['Morning flight back to Athens', 'Last-minute souvenir shopping near the airport or in Monastiraki', 'Greek coffee at a traditional café'],
    morningHe: ['טיסת בוקר חזרה לאתונה', 'קניית מזכרות אחרונות', 'קפה יווני בבית קפה מסורתי'],
    afternoon: ['Transfer to Athens International Airport', 'Check in & duty-free shopping', 'Departure flight home'],
    afternoonHe: ['העברה לנמל התעופה הבינלאומי של אתונה', 'צ\'ק-אין וקניות פטורות ממכס', 'טיסת המראה הביתה'],
    evening: ['Safe travels! Καλό ταξίδι!', 'Start planning the next Greek adventure'],
    eveningHe: ['נסיעה בטוחה! καλό ταξίδι!', 'התחילו לתכנן את ההרפתקה היוונית הבאה'],
    restaurants: ['Airport dining or grab snacks for the flight', 'Everest (Greek fast food chain at airport)'],
    restaurantsHe: ['אוכל בשדה התעופה', 'אוורסט (רשת אוכל מהיר יווני בשדה התעופה)'],
    tips: 'ATH airport has great tax-free olive oil, honey, and Greek products to bring home.',
    tipsHe: 'נמל התעופה ATH מציע שמן זית, דבש ומוצרים יוונים מצוינים ללא מס לקחת הביתה.',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayData {
  dayIndex: number;
  date: Date;
  tripDay?: TripDay;
  suggestion: DaySuggestion;
  hotel?: Hotel;
  flights: Flight[];
  driving: DrivingSegment[];
  highlights: Highlight[];
  restaurants: Restaurant[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ItineraryPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const { days, hotels, flights, driving, highlights, restaurants, config } = useTripContext();

  const tripStart = config ? parseISO(config.startDate) : parseISO('2026-03-24');
  const totalDays = config
    ? Math.round((parseISO(config.endDate).getTime() - parseISO(config.startDate).getTime()) / 86400000) + 1
    : 12;

  // Build a complete array of all trip days
  const itinerary = useMemo<DayData[]>(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const date = addDays(tripStart, i);
      const tripDay = days.find((d) => d.dayIndex === i);
      const hotel = hotels.find((h) => i >= h.dayIndexStart && i <= h.dayIndexEnd);
      const dayFlights = flights.filter((f) => f.dayIndex === i);
      const dayDriving = driving.filter((d) => d.dayIndex === i);
      const dayHighlights = highlights.filter((h) => h.dayIndex === i);
      const dayRestaurants = restaurants.filter((r) => r.dayIndex === i);
      const suggestion = GREECE_SUGGESTIONS[Math.min(i, GREECE_SUGGESTIONS.length - 1)];

      return { dayIndex: i, date, tripDay, suggestion, hotel, flights: dayFlights, driving: dayDriving, highlights: dayHighlights, restaurants: dayRestaurants };
    });
  }, [days, hotels, flights, driving, highlights, restaurants, totalDays, tripStart]);

  return (
    <div className="itinerary-page">
      <h1 className="page-title">
        {isRTL ? 'תכנית הטיול' : 'Trip Itinerary'}
      </h1>
      <p className="page-subtitle">
        {isRTL
          ? `${totalDays} ימי הרפתקה ביוון – ${format(tripStart, 'dd/MM/yyyy')}`
          : `${totalDays} days of adventure in Greece – ${format(tripStart, 'MMM d, yyyy')}`}
      </p>

      <div className="itinerary-table-container">
        {/* ─── Desktop Table ─────────────────────────────────────── */}
        <table className="itinerary-table">
          <thead>
            <tr>
              <th>{isRTL ? 'יום' : 'Day'}</th>
              <th>{isRTL ? 'תאריך ומיקום' : 'Date & Location'}</th>
              <th>{isRTL ? 'בוקר' : 'Morning'}</th>
              <th>{isRTL ? 'אחה"צ' : 'Afternoon'}</th>
              <th>{isRTL ? 'ערב' : 'Evening'}</th>
              <th>{isRTL ? 'מסעדות מומלצות' : 'Recommended Eats'}</th>
              <th>{isRTL ? 'מלון / נסיעה' : 'Hotel / Drive'}</th>
            </tr>
          </thead>
          <tbody>
            {itinerary.map((day) => (
              <ItineraryTableRow key={day.dayIndex} day={day} isRTL={isRTL} />
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Mobile Card View ────────────────────────────────────── */}
      <div className="itinerary-cards">
        {itinerary.map((day) => (
          <ItineraryCard key={day.dayIndex} day={day} isRTL={isRTL} />
        ))}
      </div>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function ItineraryTableRow({ day, isRTL }: { day: DayData; isRTL: boolean }) {
  const { dayIndex, date, tripDay, suggestion, hotel, flights: dayFlights, driving: dayDriving, highlights: dayHighlights, restaurants: dayRestaurants } = day;

  const location = isRTL
    ? (tripDay?.locationHe || tripDay?.location || suggestion.locationHe)
    : (tripDay?.location || suggestion.location);

  const morningItems = isRTL ? suggestion.morningHe : suggestion.morning;
  const afternoonItems = isRTL ? suggestion.afternoonHe : suggestion.afternoon;
  const eveningItems = isRTL ? suggestion.eveningHe : suggestion.evening;
  const restaurantItems = isRTL ? suggestion.restaurantsHe : suggestion.restaurants;

  return (
    <tr className={`itinerary-row ${dayIndex % 2 === 0 ? 'row-even' : 'row-odd'}`}>
      {/* Day Number */}
      <td className="itinerary-day-num">
        <div className="day-badge">{dayIndex + 1}</div>
      </td>

      {/* Date & Location */}
      <td className="itinerary-date-loc">
        <div className="itinerary-date">
          <Calendar size={13} />
          {format(date, 'EEE, MMM d')}
        </div>
        <div className="itinerary-location">
          <MapPin size={13} />
          {location}
        </div>
        {dayFlights.map((f) => (
          <div key={f.id} className="itinerary-flight-badge">
            <Plane size={11} />
            {f.airline} {f.flightNumber}
          </div>
        ))}
      </td>

      {/* Morning */}
      <td className="itinerary-activities">
        {dayHighlights.filter((_, i) => i < 2).map((hl) => (
          <div key={hl.id} className="itinerary-highlight-item">
            <Star size={12} color="#f59e0b" />
            <span>{hl.name}</span>
            {hl.completed && <CheckCircle2 size={11} color="#16a34a" />}
          </div>
        ))}
        {morningItems.map((item, i) => (
          <div key={i} className="itinerary-suggestion-item">
            <Sun size={11} />
            <span>{item}</span>
          </div>
        ))}
      </td>

      {/* Afternoon */}
      <td className="itinerary-activities">
        {dayHighlights.filter((_, i) => i >= 2).map((hl) => (
          <div key={hl.id} className="itinerary-highlight-item">
            <Star size={12} color="#f59e0b" />
            <span>{hl.name}</span>
          </div>
        ))}
        {dayDriving.map((dr) => (
          <div key={dr.id} className="itinerary-drive-item">
            <Car size={11} />
            <span>{dr.from} → {dr.to}</span>
            {dr.distanceKm && <span className="drive-km">{dr.distanceKm} km</span>}
          </div>
        ))}
        {afternoonItems.map((item, i) => (
          <div key={i} className="itinerary-suggestion-item">
            <Clock size={11} />
            <span>{item}</span>
          </div>
        ))}
      </td>

      {/* Evening */}
      <td className="itinerary-activities">
        {eveningItems.map((item, i) => (
          <div key={i} className="itinerary-suggestion-item">
            <Star size={11} />
            <span>{item}</span>
          </div>
        ))}
      </td>

      {/* Restaurants */}
      <td className="itinerary-restaurants">
        {dayRestaurants.map((r) => (
          <div key={r.id} className="itinerary-restaurant-item real-restaurant">
            <UtensilsCrossed size={11} />
            <span>{r.name}</span>
            {r.priceRange && <span className="price-badge">{r.priceRange}</span>}
          </div>
        ))}
        {restaurantItems.map((r, i) => (
          <div key={i} className="itinerary-restaurant-item">
            <UtensilsCrossed size={11} />
            <span>{r}</span>
          </div>
        ))}
      </td>

      {/* Hotel / Drive */}
      <td className="itinerary-hotel">
        {hotel && (
          <div className="itinerary-hotel-item">
            <Building2 size={12} />
            <span>{hotel.name}</span>
          </div>
        )}
        {dayDriving.length > 0 && (
          <div className="itinerary-drive-summary">
            <Car size={12} />
            {dayDriving[0].from} → {dayDriving[0].to}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Mobile Card ──────────────────────────────────────────────────────────────

function ItineraryCard({ day, isRTL }: { day: DayData; isRTL: boolean }) {
  const { dayIndex, date, tripDay, suggestion, hotel, flights: dayFlights, driving: dayDriving, highlights: dayHighlights, restaurants: dayRestaurants } = day;

  const title = isRTL
    ? (tripDay?.titleHe || tripDay?.title || suggestion.titleHe)
    : (tripDay?.title || suggestion.title);
  const location = isRTL
    ? (tripDay?.locationHe || tripDay?.location || suggestion.locationHe)
    : (tripDay?.location || suggestion.location);

  return (
    <div className="itinerary-card">
      {/* Header */}
      <div className="itinerary-card-header">
        <div className="day-badge">{dayIndex + 1}</div>
        <div className="itinerary-card-title-group">
          <div className="itinerary-card-title">{title}</div>
          <div className="itinerary-card-date-loc">
            <Calendar size={12} />
            <span>{format(date, 'EEE, MMM d, yyyy')}</span>
            <MapPin size={12} />
            <span>{location}</span>
          </div>
        </div>
      </div>

      {/* Flights */}
      {dayFlights.length > 0 && (
        <div className="itinerary-section">
          {dayFlights.map((f) => (
            <div key={f.id} className="itinerary-flight-badge">
              <Plane size={12} />
              {f.airline} {f.flightNumber} · {f.departureAirportCode} → {f.arrivalAirportCode}
            </div>
          ))}
        </div>
      )}

      {/* Activities from Firebase highlights */}
      {dayHighlights.length > 0 && (
        <div className="itinerary-section">
          <div className="itinerary-section-label">
            <Star size={13} color="#f59e0b" />
            {isRTL ? 'אטרקציות' : 'Highlights'}
          </div>
          {dayHighlights.map((hl) => (
            <div key={hl.id} className="itinerary-highlight-item">
              <Star size={12} color="#f59e0b" />
              <span>{hl.name}</span>
              {hl.completed && <CheckCircle2 size={11} color="#16a34a" />}
            </div>
          ))}
        </div>
      )}

      {/* Suggested Activities */}
      <div className="itinerary-section">
        <div className="itinerary-section-label">
          <Sun size={13} color="#f59e0b" />
          {isRTL ? 'פעילויות מוצעות' : 'Suggested Activities'}
        </div>
        <div className="itinerary-timeslots">
          <div className="timeslot">
            <span className="timeslot-label">{isRTL ? 'בוקר' : 'Morning'}</span>
            {(isRTL ? suggestion.morningHe : suggestion.morning).map((item, i) => (
              <div key={i} className="itinerary-suggestion-item">
                <ChevronRight size={11} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="timeslot">
            <span className="timeslot-label">{isRTL ? 'אחה"צ' : 'Afternoon'}</span>
            {(isRTL ? suggestion.afternoonHe : suggestion.afternoon).map((item, i) => (
              <div key={i} className="itinerary-suggestion-item">
                <ChevronRight size={11} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="timeslot">
            <span className="timeslot-label">{isRTL ? 'ערב' : 'Evening'}</span>
            {(isRTL ? suggestion.eveningHe : suggestion.evening).map((item, i) => (
              <div key={i} className="itinerary-suggestion-item">
                <ChevronRight size={11} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Driving */}
      {dayDriving.length > 0 && (
        <div className="itinerary-section">
          <div className="itinerary-section-label">
            <Car size={13} />
            {isRTL ? 'נסיעה' : 'Driving'}
          </div>
          {dayDriving.map((dr) => (
            <div key={dr.id} className="itinerary-drive-item">
              <Car size={11} />
              <span>{dr.from} → {dr.to}</span>
              {dr.distanceKm && <span className="drive-km">{dr.distanceKm} km</span>}
              {dr.durationMinutes && <span className="drive-km">~{dr.durationMinutes} min</span>}
            </div>
          ))}
        </div>
      )}

      {/* Restaurants */}
      <div className="itinerary-section">
        <div className="itinerary-section-label">
          <UtensilsCrossed size={13} />
          {isRTL ? 'מסעדות' : 'Where to Eat'}
        </div>
        {dayRestaurants.map((r) => (
          <div key={r.id} className="itinerary-restaurant-item real-restaurant">
            <UtensilsCrossed size={11} />
            <strong>{r.name}</strong>
            {r.priceRange && <span className="price-badge">{r.priceRange}</span>}
          </div>
        ))}
        {(isRTL ? suggestion.restaurantsHe : suggestion.restaurants).map((r, i) => (
          <div key={i} className="itinerary-restaurant-item">
            <UtensilsCrossed size={11} />
            <span>{r}</span>
          </div>
        ))}
      </div>

      {/* Hotel */}
      {hotel && (
        <div className="itinerary-section">
          <div className="itinerary-section-label">
            <Building2 size={13} />
            {isRTL ? 'מלון' : 'Hotel'}
          </div>
          <div className="itinerary-hotel-item">
            <Building2 size={12} />
            <span>{hotel.name}</span>
            {hotel.wifiPassword && (
              <span className="wifi-inline">WiFi: {hotel.wifiPassword}</span>
            )}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="itinerary-tip">
        <span className="tip-icon">💡</span>
        <span>{isRTL ? suggestion.tipsHe : suggestion.tips}</span>
      </div>
    </div>
  );
}
