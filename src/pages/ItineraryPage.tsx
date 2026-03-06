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
  // Day 0 — March 24: Arrival + Drive to Ioannina
  {
    title: 'Arrival & Drive to Ioannina',
    titleHe: 'הגעה ונסיעה ליואנינה',
    location: 'Thessaloniki → Metsovo → Ioannina',
    locationHe: 'סלוניקי → מצובו → יואנינה',
    morning: ['Land at Thessaloniki Airport (SKG)', 'Collect rental car from airport', 'Hit the Egnatia Odos highway westward'],
    morningHe: ['נחיתה בנמל התעופה של סלוניקי (SKG)', 'איסוף רכב שכור', 'נסיעה מערבה על כביש הגנאטיה אודוס'],
    afternoon: ['Stop in Metsovo — a charming mountain village', 'Try local Metsovone cheese and smoked meats', 'Walk the stone-paved main street'],
    afternoonHe: ['עצירה במצובו – כפר הרים קסום', 'טעמו גבינת מצובונה ובשרים מעושנים', 'טיול ברחוב הראשי המרוצף אבן'],
    evening: ['Arrive at Aranis, Ioannina', 'First walk around Ioannina lake promenade', 'Dinner at a lakeside taverna'],
    eveningHe: ['הגעה ל-Aranis, יואנינה', 'טיול ראשון לאורך טיילת האגם', 'ארוחת ערב בטברנה לצד האגם'],
    restaurants: ['Gastra Restaurant (Ioannina old bazaar)', 'Stoa Louli (traditional taverna)', 'Lakeside fish taverna near the castle'],
    restaurantsHe: ['מסעדת גסטרה (שוק ישן יואנינה)', 'סטואה לולי (טברנה מסורתית)', 'טברנת דגים לאגם ליד המצודה'],
    tips: 'Metsovo is at 1,100m altitude — expect cool mountain air even in late March. The drive from SKG to Ioannina via Metsovo takes ~3.5 hrs.',
    tipsHe: 'מצובו נמצאת ב-1,100 מ\' גובה – צפו לאוויר קריר גם בסוף מרץ. הנסיעה מ-SKG ליואנינה דרך מצובו לוקחת ~3.5 שעות.',
  },
  // Day 1 — March 25: Greek Independence Day — Ioannina city
  {
    title: 'Greek Independence Day — Ioannina',
    titleHe: 'יום העצמאות היווני – יואנינה',
    location: 'Ioannina',
    locationHe: 'יואנינה',
    morning: ['Watch the Greek Independence Day parade (25 Martiou)', 'Its Kale (inner castle) — Byzantine fortress on the lake', 'Ali Pasha Museum inside the castle'],
    morningHe: ['צפו במצעד יום העצמאות היווני (25 במרץ)', 'מצודת איטס קאלה – מבצר ביזנטי על שפת האגם', 'מוזיאון עלי פאשה בתוך המצודה'],
    afternoon: ['Boat to the island of Pamvotis Lake', 'Walk the car-free island village', 'Visit the monastery where Ali Pasha was killed'],
    afternoonHe: ['סירה לאי באגם פמבוטיס', 'טיול בכפר האי הפסטרלי (ללא מכוניות)', 'ביקור במנזר בו נרצח עלי פאשה'],
    evening: ['Explore the old bazaar (Kastro) streets', 'Dinner in the historic bazaar neighbourhood', 'Traditional pites (pies) — a Ioannina specialty'],
    eveningHe: ['חקירת רחובות השוק הישן (קסטרו)', 'ארוחת ערב בשכונת הבאזאר ההיסטורי', 'פשטידות מסורתיות (פיטות) – מנה ייחודית של יואנינה'],
    restaurants: ['Gastra (traditional Epirot cuisine)', 'To Mesogeio (lakeside mezze)', 'Pita bakeries in the old bazaar'],
    restaurantsHe: ['גסטרה (מטבח אפירוטי מסורתי)', 'טו מסוגיו (מזה לצד האגם)', 'מאפיות פיטה בשוק הישן'],
    tips: 'March 25 is a national holiday — many shops closed but the parade and restaurants are open. The Pamvotis island boat runs all day for ~€2/person.',
    tipsHe: '25 במרץ הוא חג לאומי – חנויות רבות סגורות אבל המצעד והמסעדות פתוחים. סירת האי פמבוטיס פועלת כל היום ב-~€2 לאדם.',
  },
  // Day 2 — March 26: Zagoria — Kipi bridges & Oxia viewpoint
  {
    title: 'Zagoria — Stone Bridges & Canyon Views',
    titleHe: 'זגוריה – גשרי אבן ותצפיות הצוק',
    location: 'Zagoria (Kipi area)',
    locationHe: 'זגוריה (אזור קיפוי)',
    morning: ['Drive to Kipi village in Zagoria (~45 min from Ioannina)', 'Kokkoris Bridge — single-arch 18th-century stone bridge', 'Kalogeriko Bridge — triple-arch stone bridge over the river'],
    morningHe: ['נסיעה לכפר קיפוי בזגוריה (~45 דקות מיואנינה)', 'גשר קוקוריס – גשר אבן חד-קשת מהמאה ה-18', 'גשר קלוגריקו – גשר אבן תלת-קשת מעל הנחל'],
    afternoon: ['Drive to Oxia viewpoint — panoramic view over Vikos Gorge (one of deepest in world)', 'Monodendri village — stone-built Zagori architecture', 'Vikos Gorge overlook trail (short walk)'],
    afternoonHe: ['נסיעה לנקודת תצפית אוקסיה – נוף פנורמי על גיא ויקוס (אחד העמוקים בעולם)', 'כפר מונודנדרי – אדריכלות אבן זגורית', 'מסלול תצפית לגיא ויקוס (הליכה קצרה)'],
    evening: ['Return to Ioannina for dinner', 'Local taverna on the waterfront'],
    eveningHe: ['חזרה ליואנינה לארוחת ערב', 'טברנה מקומית על שפת המים'],
    restaurants: ['Taverna in Monodendri village', 'Aristi Mountain Resort restaurant (if passing)', 'Lakeside restaurants in Ioannina'],
    restaurantsHe: ['טברנה בכפר מונודנדרי', 'מסעדת Aristi Mountain Resort (בדרך)', 'מסעדות לאגם ביואנינה'],
    tips: 'The Oxia viewpoint road can be narrow — drive carefully. Vikos Gorge is listed in Guinness as the deepest canyon relative to its width.',
    tipsHe: 'הדרך לנקודת תצפית אוקסיה עלולה להיות צרה – נהגו בזהירות. גיא ויקוס רשום בגינס כהוואדי העמוק ביותר ביחס לרוחבו.',
  },
  // Day 3 — March 27: Voidomatis River + Papigo
  {
    title: 'Zagoria — Voidomatis River & Papigo',
    titleHe: 'זגוריה – נהר ווידומאטיס ופפיגו',
    location: 'Zagoria (Papigo area)',
    locationHe: 'זגוריה (אזור פפיגו)',
    morning: ['Drive to Voidomatis River trailhead (near Kipi/Kleidonia)', 'Voidomatis River Trail — turquoise crystal-clear water', 'Optional short kayak/rafting (seasonal)'],
    morningHe: ['נסיעה לנקודת ההתחלה של מסלול נהר ווידומאטיס', 'מסלול נהר ווידומאטיס – מים טורקיז צלולים בצורה מדהימה', 'קיאקינג/רפטינג קצר (עונתי)'],
    afternoon: ['Drive to Papigo — twin villages (Megalo & Mikro Papigo)', 'Rogovo Pools — natural rock pools carved by the river', 'Explore the traditional stone architecture of Papigo'],
    afternoonHe: ['נסיעה לפפיגו – זוג כפרים (מגאלו ומיקרו פפיגו)', 'בריכות רוגובו – בריכות טבעיות שגולפו ע"י הנחל', 'חקירת האדריכלות האבן המסורתית של פפיגו'],
    evening: ['Return to Ioannina', 'Dinner — try the local metsovela pasta or grilled trout'],
    eveningHe: ['חזרה ליואנינה', 'ארוחת ערב – נסו פסטה מצובלה מקומית או פורל צלוי'],
    restaurants: ['Papigo village guesthouse restaurant', 'To Monopati (Papigo)', 'Ioannina waterfront for dinner'],
    restaurantsHe: ['מסעדת אכסנייה בפפיגו', 'טו מונופאטי (פפיגו)', 'חוף האגם ביואנינה לארוחת ערב'],
    tips: 'Voidomatis is one of the clearest rivers in Europe — the water runs off the Pindus mountains. Rogovo pools are a 15-min walk from the Mikro Papigo car park.',
    tipsHe: 'ווידומאטיס הוא אחד הנהרות הצלולים ביותר באירופה – המים זורמים מהרי פינדוס. בריכות רוגובו במרחק 15 דקות הליכה מחניון מיקרו פפיגו.',
  },
  // Day 4 — March 28: Tsoumerka — Kipina Monastery + Pramenti
  {
    title: 'Tsoumerka — Kipina Monastery & Mountain Villages',
    titleHe: 'צומרקה – מנזר קיפינה וכפרי ההרים',
    location: 'Tsoumerka (Kipina & Pramenti)',
    locationHe: 'צומרקה (קיפינה ופרמנטי)',
    morning: ['Drive south to Tsoumerka area (~1.5 hrs from Ioannina)', 'Kipina Cave Monastery — dramatically carved into a cliff face', 'Hanging rope bridge access to the monastery'],
    morningHe: ['נסיעה דרומה לאזור צומרקה (~1.5 שעות מיואנינה)', 'מנזר מערת קיפינה – חצוב בצורה דרמטית בפני צוק', 'גישה למנזר דרך גשר חבל תלוי'],
    afternoon: ['Pramenti village — traditional Epirote mountain village', 'Walk the village lanes among stone houses', 'Optional: Pertouli ski village views (if snow remains)'],
    afternoonHe: ['כפר פרמנטי – כפר הרים אפירוטי מסורתי', 'טיול בסמטאות הכפר בין בתי האבן', 'אפשרות: נוף כפר הסקי פרטולי (אם נותר שלג)'],
    evening: ['Scenic drive back to Ioannina', 'Relaxed dinner — last night at Aranis'],
    eveningHe: ['נסיעה ציורית חזרה ליואנינה', 'ארוחת ערב נינוחה – הלילה האחרון ב-Aranis'],
    restaurants: ['Village kafeneion in Pramenti for coffee & snacks', 'Tsoumerka area local taverna', 'Ioannina restaurant for a proper dinner'],
    restaurantsHe: ['קפנאיון כפרי בפרמנטי לקפה וחטיפים', 'טברנה מקומית באזור צומרקה', 'מסעדה ביואנינה לארוחה כמו שצריך'],
    tips: 'Kipina Monastery is one of the most dramatic monastery settings in all of Greece — carved directly into a vertical cliff. The monastery is still active.',
    tipsHe: 'מנזר קיפינה הוא אחד האתרים הדרמטיים ביותר ביוון – חצוב ישירות בצוק אנכי. המנזר עדיין פעיל.',
  },
  // Day 5 — March 29: Drive to Palaios Agios Athanasios
  {
    title: 'Drive to Palaios Agios Athanasios',
    titleHe: 'נסיעה לפלאיוס אגיוס אתנאסיוס',
    location: 'Ioannina → Palaios Agios Athanasios',
    locationHe: 'יואנינה → פלאיוס אגיוס אתנאסיוס',
    morning: ['Checkout from Aranis', 'Final Ioannina morning walk around the castle', 'Pack up and head north on Via Egnatia'],
    morningHe: ['צ\'ק-אאוט מ-Aranis', 'טיול בוקר אחרון ביואנינה סביב המצודה', 'ארוז ויצא צפונה על כביש הגנאטיה'],
    afternoon: ['Scenic mountain drive through Florina region', 'Arrive at Palaios Agios Athanasios', 'Check in to Domotel Neve'],
    afternoonHe: ['נסיעת הרים ציורית דרך אזור פלורינה', 'הגעה לפלאיוס אגיוס אתנאסיוס', 'צ\'ק-אין לאכסנייה בוטיק'],
    evening: ['Explore the peaceful mountain village', 'Dinner at a local taverna', 'Plan tomorrow\'s visit to Pozar Thermal Baths'],
    eveningHe: ['חקירת הכפר ההרי השקט', 'ארוחת ערב בטברנה מקומית', 'תכננו את ביקור מחר בבריכות החמות פוזאר'],
    restaurants: ['Local village taverna near the guesthouse', 'Ask your hosts for their recommendation'],
    restaurantsHe: ['טברנה כפרית מקומית ליד האכסנייה', 'שאלו את המארחים להמלצה שלהם'],
    tips: 'Palaios Agios Athanasios is a quiet mountain base — perfect for relaxing after 5 days of hiking in Zagoria. The drive from Ioannina is ~3 hours.',
    tipsHe: 'פלאיוס אגיוס אתנאסיוס הוא בסיס הרים שקט – מושלם להירגעות אחרי 5 ימי הליכה בזגוריה. הנסיעה מיואנינה היא ~3 שעות.',
  },
  // Day 6 — March 30: Pozar Thermal Baths
  {
    title: 'Pozar Thermal Baths',
    titleHe: 'בריכות החמות פוזאר',
    location: 'Pozar / Loutraki',
    locationHe: 'פוזאר / לוטרקי',
    morning: ['Drive to Pozar Thermal Baths (Loutraki village)', 'Outdoor thermal pools fed by natural hot springs (~37°C)', 'Waterfall alongside the pools — magical setting'],
    morningHe: ['נסיעה לבריכות החמות פוזאר (כפר לוטרקי)', 'בריכות חמות חיצוניות מוזנות מעיינות טבעיים (~37°C)', 'מפל לצד הבריכות – אתמוספרה קסומה'],
    afternoon: ['Explore Loutraki village', 'Optional: drive to Aridaia town for lunch & shopping', 'Afternoon soak — combine hot spring pool & cold river water'],
    afternoonHe: ['חקירת כפר לוטרקי', 'אפשרות: נסיעה לעיירת אריאה לצהריים וקניות', 'השריה אחר הצהריים – שלבו בריכה חמה ומי נחל קרים'],
    evening: ['Return to guesthouse', 'Relaxed dinner — local grilled meats'],
    eveningHe: ['חזרה לאכסנייה', 'ארוחת ערב נינוחה – בשרים צלויים מקומיים'],
    restaurants: ['Taverna at Loutraki (near the baths)', 'Pozar Baths café for snacks', 'Village restaurant at Palaios Agios Athanasios'],
    restaurantsHe: ['טברנה בלוטרקי (ליד הבריכות)', 'קפה בריכות פוזאר לחטיפים', 'מסעדת כפר בפלאיוס אגיוס אתנאסיוס'],
    tips: 'Pozar has both a large public outdoor pool complex and smaller natural pools by the waterfall. Entry ~€5/adult. Bring water shoes and a towel.',
    tipsHe: 'לפוזאר יש מתחם בריכות ציבורי חיצוני גדול וגם בריכות טבעיות קטנות ליד המפל. כניסה ~€5/מבוגר. קחו נעלי מים ומגבת.',
  },
  // Day 7 — March 31: Edessa Waterfalls → Thessaloniki
  {
    title: 'Edessa Waterfalls & Drive to Thessaloniki',
    titleHe: 'מפלי אדסה ונסיעה לסלוניקי',
    location: 'Edessa → Thessaloniki',
    locationHe: 'אדסה → סלוניקי',
    morning: ['Drive to Edessa (~45 min from Palaios Agios Athanasios)', 'Edessa Waterfalls Park — multiple waterfalls cascading into a gorge', 'Main waterfall drops 70m — one of Greece\'s most impressive'],
    morningHe: ['נסיעה לאדסה (~45 דקות מפלאיוס אגיוס אתנאסיוס)', 'פארק מפלי אדסה – מספר מפלים שצוללים לגיא', 'המפל הראשי צונח 70 מ\' – אחד המרשימים ביוון'],
    afternoon: ['Explore Edessa town centre', 'Drive to Thessaloniki (~100 km, ~1.5 hrs)', 'Check into Thessaloniki Center Superior Apartment (Tsimiski 126)'],
    afternoonHe: ['חקירת מרכז העיר אדסה', 'נסיעה לסלוניקי (~100 ק"מ, ~1.5 שעות)', 'צ\'ק-אין לדירת Thessaloniki Center Superior Apartment (Tsimiski 126)'],
    evening: ['First evening in Thessaloniki — walk Tsimiski street', 'Ladadika neighbourhood — bars, restaurants, nightlife', 'Try the famous Thessaloniki bougatsa (custard pastry)'],
    eveningHe: ['ערב ראשון בסלוניקי – טיול ברחוב חמיסקי', 'שכונת לדדיקה – ברים, מסעדות, חיי לילה', 'נסו את הבוגצה המפורסמת של סלוניקי (מאפה קרם)'],
    restaurants: ['Ladadika neighbourhood restaurants', 'Aristotelous square cafes for bougatsa', 'Zythos (craft beer & Greek meze)'],
    restaurantsHe: ['מסעדות שכונת לדדיקה', 'בתי קפה בכיכר אריסטוטלוס לבוגצה', 'זיטוס (בירה מקומית ומזה יווני)'],
    tips: 'Edessa waterfalls are best viewed from the walkway path that runs below them. The town\'s old aqueduct district is also worth a short stroll.',
    tipsHe: 'מפלי אדסה נצפים בצורה הטובה ביותר מהשביל שרץ מתחתיהם. גם מחוז האמה הישן של העיר שווה טיול קצר.',
  },
  // Day 8 — April 1: Thessaloniki Waterfront & Ladadika
  {
    title: 'Thessaloniki Waterfront & Ladadika',
    titleHe: 'טיילת סלוניקי ושכונת לדדיקה',
    location: 'Thessaloniki',
    locationHe: 'סלוניקי',
    morning: ['Nea Paralia (New Waterfront) morning walk — 3.5 km promenade', 'The Umbrellas sculpture — iconic Thessaloniki landmark', 'Aristotle Square and the city centre buzz'],
    morningHe: ['טיול בוקר על נאה פראליה (טיילת חדשה) – 3.5 ק"מ', 'פסל המטריות – סמל מוכר של סלוניקי', 'כיכר אריסטוטלוס ותוסס מרכז העיר'],
    afternoon: ['Byzantine Walls of Thessaloniki (Heptapyrgion fortress)', 'Rotunda — Roman monument turned Christian church', 'Arch of Galerius (Kamara) selfie stop'],
    afternoonHe: ['חומות ביזנטיות של סלוניקי (מבצר הפטפירגיון)', 'רוטונדה – אנדרטה רומית שהפכה לכנסייה נוצרית', 'עצירת סלפי בקשת גלריוס (קמארה)'],
    evening: ['Ladadika neighbourhood dinner — the social heart of Thessaloniki', 'Explore the Ottoman-era warehouses turned restaurants', 'Late-night coffee culture — Thessaloniki style'],
    eveningHe: ['ארוחת ערב בשכונת לדדיקה – הלב החברתי של סלוניקי', 'חקירת מחסני התקופה העות\'מאנית שהפכו למסעדות', 'תרבות הקפה בשעות הלילה – בסגנון סלוניקי'],
    restaurants: ['Tsinari (mezze on the waterfront)', 'Myrsini (traditional Northern Greek)', 'Ladadika street restaurants for evening'],
    restaurantsHe: ['צינארי (מזה על הטיילת)', 'מירסיני (מסורתי צפון יווני)', 'מסעדות רחוב לדדיקה לערב'],
    tips: 'The Nea Paralia runs from the Concert Hall to the White Tower. Grab a coffee and watch the locals jog and cycle along the waterfront.',
    tipsHe: 'הנאה פראליה מתחילה מהאולם הפילהרמוני ומגיעה עד מגדל הלבן. קחו קפה וצפו בתושבים המקומיים רצים ורוכבים לאורך הטיילת.',
  },
  // Day 9 — April 2: NOESIS Science Museum + Cosmos Mall
  {
    title: 'NOESIS Science Museum & Cosmos Mall',
    titleHe: 'מוזיאון המדע נואסיס וקוסמוס מול',
    location: 'Thessaloniki',
    locationHe: 'סלוניקי',
    morning: ['NOESIS Science Center & Technology Museum', 'Hands-on science exhibits for all ages', 'Planetarium show — Greek & solar system themes'],
    morningHe: ['מרכז המדע והטכנולוגיה נואסיס', 'תערוכות מדע אינטראקטיביות לכל הגילאים', 'מופע פלנטריום – נושאי יוון ומערכת השמש'],
    afternoon: ['Cosmos Mediterranean Mall — largest mall in Northern Greece', 'Shopping + entertainment + kids activities', 'Optional: IKEA nearby if needed'],
    afternoonHe: ['קוסמוס מדיטרניאן מול – הקניון הגדול ביותר בצפון יוון', 'קניות + בידור + פעילויות לילדים', 'אפשרות: IKEA בקרבת מקום במידת הצורך'],
    evening: ['Dinner at the mall or head back to the city', 'Evening walk on Tsimiski street shopping area'],
    eveningHe: ['ארוחת ערב בקניון או חזרה לעיר', 'טיול ערב באזור הקניות ברחוב חמיסקי'],
    restaurants: ['Cosmos Mall food court options', 'City centre restaurants for the evening', 'Navagios (Thessaloniki seafood favourite)'],
    restaurantsHe: ['אפשרויות ממוזנות בקוסמוס מול', 'מסעדות מרכז העיר לערב', 'נוואגיוס (פירות ים מועדפים בסלוניקי)'],
    tips: 'NOESIS also has a vintage aircraft and Formula 1 car outside. Book planetarium tickets online. Cosmos Mall has free parking.',
    tipsHe: 'גם ל-NOESIS יש מטוס ישן ומכונית פורמולה 1 בחוץ. הזמינו כרטיסים לפלנטריום אונליין. בקוסמוס מול יש חניה חינמית.',
  },
  // Day 10 — April 3: White Tower, Modiano Market, Pirate Boat
  {
    title: 'White Tower, Modiano Market & Pirate Boat',
    titleHe: 'מגדל הלבן, שוק מודיאנו וסירת הפיראטים',
    location: 'Thessaloniki',
    locationHe: 'סלוניקי',
    morning: ['Modiano Market — covered historic food market', 'Fresh olives, spices, local cheeses & street food', 'White Tower museum — history of Thessaloniki'],
    morningHe: ['שוק מודיאנו – שוק אוכל היסטורי מקורה', 'זיתים טריים, תבלינים, גבינות מקומיות ואוכל רחוב', 'מוזיאון מגדל הלבן – ההיסטוריה של סלוניקי'],
    afternoon: ['Pirate Ship Bay Tour — cruise in the Thermaic Gulf', 'Views of Thessaloniki skyline from the sea', 'Spot Mount Olympus across the bay on clear days'],
    afternoonHe: ['סיור סירת פיראטים בלגוס – שייט במפרץ הטרמאיקוס', 'נוף קו האופק של סלוניקי מהים', 'צפיית הר אולימפוס מעבר למפרץ בימים בהירים'],
    evening: ['Xarchakos Park (riverside park) sunset walk', 'Final Thessaloniki dinner — go all out!', 'Trigona pastries for dessert — a Thessaloniki staple'],
    eveningHe: ['טיול שקיעה בפארק ג\'רקוס (פארק נחל)', 'ארוחת ערב אחרונה בסלוניקי – שיהיה מושלם!', 'מאפה טריגונה לקינוח – בסיסי סלוניקי'],
    restaurants: ['Mourga (seafood by the port)', 'I Nea Folia (traditional)', 'Trigona Elenidis (famous dessert shop)'],
    restaurantsHe: ['מורגה (פירות ים ליד הנמל)', 'אי נה פוליה (מסורתי)', 'טריגונה אלנידיס (חנות קינוחים מפורסמת)'],
    tips: 'The pirate ship tours depart from the port area near the White Tower — check seasonal schedules. Modiano Market is best visited in the morning before 1pm.',
    tipsHe: 'סיורי סירת הפיראטים יוצאים מאזור הנמל ליד מגדל הלבן – בדקו לוחות זמנים עונתיים. שוק מודיאנו הכי טוב לביקור בבוקר לפני 13:00.',
  },
  // Day 11 — April 4: Departure
  {
    title: 'Departure from Thessaloniki',
    titleHe: 'עזיבה מסלוניקי',
    location: 'Thessaloniki (SKG)',
    locationHe: 'סלוניקי (SKG)',
    morning: ['Final Thessaloniki breakfast — koulouri bread & Greek coffee', 'Last-minute souvenir shopping on Tsimiski St.', 'Return rental car at Thessaloniki Airport (SKG)'],
    morningHe: ['ארוחת בוקר אחרונה בסלוניקי – קולורי ולחם יווני עם קפה', 'קניית מזכרות אחרונות ברחוב חמיסקי', 'החזרת הרכב השכור בנמל התעופה של סלוניקי (SKG)'],
    afternoon: ['Check in at Thessaloniki International Airport "Makedonia"', 'Duty-free shopping — Greek olive oil, honey, herbs', 'Departure flight home — Καλό ταξίδι!'],
    afternoonHe: ['צ\'ק-אין בנמל התעופה הבינלאומי של סלוניקי "מקדוניה"', 'קניות פטורות ממכס – שמן זית יווני, דבש, תבלינים', 'טיסת המראה הביתה – Καλό ταξίδι!'],
    evening: ['Arrive home with wonderful memories', 'Start the photo album!'],
    eveningHe: ['הגעה הביתה עם זיכרונות נהדרים', 'התחילו לארגן את אלבום התמונות!'],
    restaurants: ['Airport café for last coffee', 'Everest (Greek fast-food chain at airport)'],
    restaurantsHe: ['קפה בשדה התעופה לקפה אחרון', 'Everest (רשת מזון מהיר יוונית בשדה התעופה)'],
    tips: 'SKG Airport is compact — arrive 2 hours early. Pick up local Thessaloniki trigona sweets as gifts from the airport shop.',
    tipsHe: 'נמל התעופה SKG קומפקטי – הגיעו 2 שעות לפני הטיסה. קנו ממתקי טריגונה של סלוניקי כמתנות מחנות שדה התעופה.',
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
            <span>{isRTL ? (hl.nameHe || hl.name) : hl.name}</span>
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
            <span>{isRTL ? (hl.nameHe || hl.name) : hl.name}</span>
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
            <span>{isRTL ? (r.nameHe || r.name) : r.name}</span>
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
              <span>{isRTL ? (hl.nameHe || hl.name) : hl.name}</span>
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
            <strong>{isRTL ? (r.nameHe || r.name) : r.name}</strong>
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
