import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, CheckCircle, XCircle, Trophy, Star, Lock } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { saveQuizAnswer } from '../firebase/tripService';
import type { QuizQuestion, QuizAnswer } from '../types/trip';

const TOTAL_DAYS = 12;
const TRIP_START = new Date('2026-03-24T00:00:00');

// ─── All quiz questions ────────────────────────────────────────────────────────
// dayIndex -10 to -1: pre-trip (always unlocked)
// dayIndex 0-11: trip days (unlocked when today >= tripStart + dayIndex days)

const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ══════════════════════ PRE-TRIP (dayIndex -10 to -1) ══════════════════════
  {
    id: 'pre1',
    dayIndex: -10,
    question: 'What is the capital city of Greece?',
    questionHe: 'מהי עיר הבירה של יוון?',
    options: ['Thessaloniki', 'Athens', 'Heraklion', 'Patras'],
    optionsHe: ['סלוניקי', 'אתונה', 'הרקליון', 'פטרה'],
    correctIndex: 1,
    funFact: 'Athens is one of the world\'s oldest cities, with a recorded history spanning over 3,400 years!',
    funFactHe: 'אתונה היא אחת הערים הוותיקות ביותר בעולם, עם היסטוריה מתועדת של מעל 3,400 שנה!',
  },
  {
    id: 'pre2',
    dayIndex: -9,
    question: 'What currency is used in Greece?',
    questionHe: 'איזו מטבע משתמשים ביוון?',
    options: ['Drachma', 'Lira', 'Euro', 'Pound'],
    optionsHe: ['דרכמה', 'לירה', 'יורו', 'פאונד'],
    correctIndex: 2,
    funFact: 'Greece adopted the Euro in 2002, replacing the ancient drachma which had been used for over 2,500 years!',
    funFactHe: 'יוון אימצה את היורו ב-2002, והחליפה את הדרכמה העתיקה שהיתה בשימוש במשך מעל 2,500 שנה!',
  },
  {
    id: 'pre3',
    dayIndex: -8,
    question: 'What colors are on the Greek flag?',
    questionHe: 'אילו צבעים מופיעים על דגל יוון?',
    options: ['Red and white', 'Blue and yellow', 'Blue and white', 'White and gold'],
    optionsHe: ['אדום ולבן', 'כחול וצהוב', 'כחול ולבן', 'לבן וזהב'],
    correctIndex: 2,
    funFact: 'The nine stripes on the Greek flag represent the nine syllables of the phrase "Eleftheria i Thanatos" (Freedom or Death)!',
    funFactHe: 'תשעת הפסים על הדגל היווני מייצגים את תשעת ההברות של הביטוי "אלפתריה אי תנטוס" (חירות או מוות)!',
  },
  {
    id: 'pre4',
    dayIndex: -7,
    question: 'What language is spoken in Greece?',
    questionHe: 'באיזו שפה מדברים ביוון?',
    options: ['Latin', 'Byzantine', 'Greek', 'Macedonian'],
    optionsHe: ['לטינית', 'ביזנטית', 'יוונית', 'מקדונית'],
    correctIndex: 2,
    funFact: 'Greek is one of the oldest recorded living languages, with documents written in Greek dating back 3,500 years!',
    funFactHe: 'יוונית היא אחת השפות החיות המתועדות הוותיקות ביותר, עם מסמכים בכתב יווני שמגיעים לגיל 3,500 שנה!',
  },
  {
    id: 'pre5',
    dayIndex: -6,
    question: 'Greece has the longest coastline in which area?',
    questionHe: 'ליוון יש קו החוף הארוך ביותר באיזה אזור?',
    options: ['The Balkans', 'The European Union', 'The Mediterranean', 'Southern Europe'],
    optionsHe: ['הבלקן', 'האיחוד האירופי', 'הים התיכון', 'דרום אירופה'],
    correctIndex: 1,
    funFact: 'Greece has the longest coastline in the EU at about 13,676 km — longer than the entire US East Coast!',
    funFactHe: 'ליוון יש קו החוף הארוך ביותר באיחוד האירופי — כ-13,676 ק"מ, ארוך יותר מכל חוף המזרח של ארצות הברית!',
  },
  {
    id: 'pre6',
    dayIndex: -5,
    question: 'How many UNESCO World Heritage Sites does Greece have?',
    questionHe: 'כמה אתרי מורשת עולמית של אונסקו יש ליוון?',
    options: ['7', '12', '18', '5'],
    optionsHe: ['7', '12', '18', '5'],
    correctIndex: 2,
    funFact: 'Greece has 18 UNESCO World Heritage Sites, including the Acropolis, Delphi, Meteora, and Thessaloniki\'s Paleochristian monuments!',
    funFactHe: 'ליוון יש 18 אתרי מורשת עולמית של אונסקו, כולל האקרופוליס, דלפי, מטאורה ומונומנטים פלאוכריסטיים בסלוניקי!',
  },
  {
    id: 'pre7',
    dayIndex: -4,
    question: 'Where were the first Olympic Games held?',
    questionHe: 'היכן נערכו המשחקים האולימפיים הראשונים?',
    options: ['Athens', 'Sparta', 'Olympia', 'Delphi'],
    optionsHe: ['אתונה', 'ספרטה', 'אולימפיה', 'דלפי'],
    correctIndex: 2,
    funFact: 'The ancient Olympic Games began in 776 BC in Olympia, a sanctuary of Zeus in the western Peloponnese region of Greece!',
    funFactHe: 'המשחקים האולימפיים העתיקים החלו ב-776 לפנה"ס באולימפיה, מקדש זאוס באזור הפלופונסוס המערבי של יוון!',
  },
  {
    id: 'pre8',
    dayIndex: -3,
    question: 'What is "yamas" in Greek culture?',
    questionHe: 'מה זה "יאמאס" בתרבות היוונית?',
    options: ['A traditional dance', 'A toast meaning "to our health"', 'A type of cheese', 'A sea creature'],
    optionsHe: ['ריקוד מסורתי', 'לחיים שפירושו "לבריאותנו"', 'סוג גבינה', 'יצור ים'],
    correctIndex: 1,
    funFact: '"Yamas!" is the Greek equivalent of "Cheers!" — literally "to our health." You\'ll hear it at every taverna in Greece!',
    funFactHe: '"יאמאס!" הוא המקבילה היוונית ל"לחיים!" — פירושו המילולי "לבריאותנו". תשמעו אותו בכל טברנה ביוון!',
  },
  {
    id: 'pre9',
    dayIndex: -2,
    question: 'What is the approximate population of Greece?',
    questionHe: 'מהי האוכלוסייה המשוערת של יוון?',
    options: ['5 million', '10.7 million', '15 million', '7 million'],
    optionsHe: ['5 מיליון', '10.7 מיליון', '15 מיליון', '7 מיליון'],
    correctIndex: 1,
    funFact: 'Greece has about 10.7 million people. However, around 7 million Greeks live abroad — the Greek diaspora is enormous!',
    funFactHe: 'ביוון כ-10.7 מיליון תושבים. עם זאת, כ-7 מיליון יוונים חיים בחו"ל — הדיאספורה היוונית ענקית!',
  },
  {
    id: 'pre10',
    dayIndex: -1,
    question: 'Greece is considered the birthplace of what?',
    questionHe: 'יוון נחשבת ערש הולדת של מה?',
    options: ['Democracy', 'The alphabet', 'Mathematics', 'All of the above'],
    optionsHe: ['דמוקרטיה', 'האלפבית', 'מתמטיקה', 'כל האמור לעיל'],
    correctIndex: 3,
    funFact: 'Ancient Greece gave the world democracy, the alphabet (via Phoenician adaptation), philosophy, geometry, the Olympics, drama, and much more!',
    funFactHe: 'יוון העתיקה העניקה לעולם דמוקרטיה, פילוסופיה, גיאומטריה, אולימפיאדה, דרמה, ועוד הרבה!',
  },

  // ══════════════════════ DAY 0 — Athens Arrival ══════════════════════
  {
    id: 'q1',
    dayIndex: 0,
    question: 'How many islands does Greece have?',
    questionHe: 'כמה איים יש ביוון?',
    options: ['~1,200', '~6,000', '~200', '~50'],
    optionsHe: ['~1,200', '~6,000', '~200', '~50'],
    correctIndex: 1,
    funFact: 'Greece has between 1,200 and 6,000 islands depending on the minimum size definition — but only about 227 are inhabited!',
    funFactHe: 'ליוון יש בין 1,200 ל-6,000 איים תלוי בהגדרת הגודל המינימלי — אך רק כ-227 מיושבים!',
  },
  {
    id: 'q1b',
    dayIndex: 0,
    question: 'What is the name of Athens\' main international airport?',
    questionHe: 'מה שם נמל התעופה הבינלאומי הראשי של אתונה?',
    options: ['Nikos Kazantzakis', 'Eleftherios Venizelos', 'Kostas Simitis', 'Aristotle Onassis'],
    optionsHe: ['ניקוס קזנטזאקיס', 'אלפתריוס ונιזלוס', 'קוסטס סימיטיס', 'אריסטוטלס אונסיס'],
    correctIndex: 1,
    funFact: 'Athens International Airport (ATH) is named after Eleftherios Venizelos, one of Greece\'s most prominent 20th-century statesmen!',
    funFactHe: 'נמל התעופה הבינלאומי של אתונה נקרא על שם אלפתריוס ונιזלוס, אחד המדינאים הבולטים של יוון במאה ה-20!',
  },
  {
    id: 'q1c',
    dayIndex: 0,
    question: 'Syntagma Square in Athens is home to what building?',
    questionHe: 'כיכר סינטגמה באתונה היא מולת איזה בניין?',
    options: ['The Parthenon', 'The Presidential Palace', 'The Hellenic Parliament', 'The National Museum'],
    optionsHe: ['הפרתנון', 'ארמון הנשיא', 'הפרלמנט היווני', 'המוזיאון הלאומי'],
    correctIndex: 2,
    funFact: 'The Hellenic Parliament (Vouli) in Syntagma Square was built as a Royal Palace in 1843 and converted to parliament in 1929!',
    funFactHe: 'הפרלמנט היווני בכיכר סינטגמה נבנה כארמון מלכותי ב-1843 והוסב לפרלמנט ב-1929!',
  },
  {
    id: 'q1d',
    dayIndex: 0,
    question: 'What does "Monastiraki" mean in Greek?',
    questionHe: 'מה פירוש "מונסטירקי" ביוונית?',
    options: ['Market of flowers', 'Little monastery', 'Ancient ruins', 'Fish market'],
    optionsHe: ['שוק פרחים', 'מנזר קטן', 'חורבות עתיקות', 'שוק דגים'],
    correctIndex: 1,
    funFact: 'Monastiraki gets its name from the small monastery that once stood in the area. Today it\'s one of Athens\' most vibrant neighbourhoods!',
    funFactHe: 'מונסטירקי קיבל את שמו מהמנזר הקטן שעמד פעם באזור. היום זה אחד השכונות הפעילות ביותר באתונה!',
  },
  {
    id: 'q1e',
    dayIndex: 0,
    question: 'What is the Evzone Guard famous for wearing?',
    questionHe: 'במה מפורסמים שומרי האבזון?',
    options: ['Leather jackets', 'Fustanella (pleated skirts)', 'Roman togas', 'Navy uniforms'],
    optionsHe: ['ג\'קטים עור', 'פוסטנלה (חצאיות קפלים)', 'טוגות רומיות', 'מדים ימיים'],
    correctIndex: 1,
    funFact: 'The Evzone guards wear the fustanella (pleated white skirt) and pom-pom shoes (tsarouchi). Each fustanella has exactly 400 pleats — one for each year of Ottoman occupation!',
    funFactHe: 'שומרי האבזון לובשים פוסטנלה (חצאית לבנה עם קפלים) ונעלי פונפון. לכל פוסטנלה בדיוק 400 קפלים — אחד לכל שנה של הכיבוש העות\'מאני!',
  },

  // ══════════════════════ DAY 1 — Athens (Acropolis) ══════════════════════
  {
    id: 'q2',
    dayIndex: 1,
    question: 'What is the Greek word for "hello"?',
    questionHe: 'מה המילה ביוונית ל"שלום"?',
    options: ['Kalimera', 'Yasou', 'Efharisto', 'Opa'],
    optionsHe: ['קלימרה', 'יאסו', 'אפחריסטו', 'אופה'],
    correctIndex: 1,
    funFact: 'Yasou literally means "to your health!" — Kalimera means "good morning" and Efharisto means "thank you."',
    funFactHe: 'יאסו פירושו המילולי "לבריאותך!" — קלימרה פירושה "בוקר טוב" ואפחריסטו פירושה "תודה".',
  },
  {
    id: 'q2b',
    dayIndex: 1,
    question: 'The Parthenon was built as a temple to which goddess?',
    questionHe: 'הפרתנון נבנה כמקדש לאיזו אלה?',
    options: ['Hera', 'Aphrodite', 'Athena', 'Artemis'],
    optionsHe: ['הרה', 'אפרודיטה', 'אתנה', 'ארטמיס'],
    correctIndex: 2,
    funFact: 'The Parthenon was dedicated to Athena Parthenos (Athena the Virgin), the patron goddess of Athens. Inside stood a 12-meter tall gold-and-ivory statue of her!',
    funFactHe: 'הפרתנון הוקדש לאתנה פרתנוס (אתנה הבתולה), האלה המגינה על אתונה. בפנים עמד פסל זהב ושנהב בגובה 12 מטר שלה!',
  },
  {
    id: 'q2c',
    dayIndex: 1,
    question: 'What does "Acropolis" literally mean?',
    questionHe: 'מה פירושו המילולי של "אקרופוליס"?',
    options: ['Ancient city', 'High city', 'Sacred hill', 'Stone fortress'],
    optionsHe: ['עיר עתיקה', 'עיר גבוהה', 'גבעה קדושה', 'מבצר אבן'],
    correctIndex: 1,
    funFact: '"Acropolis" comes from the Greek words "akros" (high/top) and "polis" (city). Many ancient Greek cities had an acropolis — Athens\' is simply the most famous!',
    funFactHe: '"אקרופוליס" מגיע מהמילים היווניות "אקרוס" (גבוה/עליון) ו"פוליס" (עיר). לערים יווניות עתיקות רבות היה אקרופוליס — של אתונה פשוט המפורסם ביותר!',
  },
  {
    id: 'q2d',
    dayIndex: 1,
    question: 'The Ancient Agora of Athens was used primarily as what?',
    questionHe: 'לאיזה שימוש שימשה האגורה העתיקה של אתונה בעיקר?',
    options: ['A gladiatorial arena', 'A public marketplace and civic center', 'A royal palace', 'A military barracks'],
    optionsHe: ['זירת גלדיאטורים', 'שוק ציבורי ומרכז אזרחי', 'ארמון מלכותי', 'כפר צבאי'],
    correctIndex: 1,
    funFact: 'The Agora was the heart of ancient Athenian public life — where citizens voted, philosophers debated, merchants traded, and courts held trials. Socrates taught here!',
    funFactHe: 'האגורה הייתה לב חיי הציבור האתנאי העתיקים — שם הצביעו אזרחים, פילוסופים ויכחו, סוחרים שוחחו ובתי משפט שפטו. סוקרטס לימד כאן!',
  },
  {
    id: 'q2e',
    dayIndex: 1,
    question: 'Lycabettus Hill offers the best panoramic view of which city?',
    questionHe: 'גבעת לוקבטוס מציעה את הנוף הפנורמי הטוב ביותר של איזו עיר?',
    options: ['Thessaloniki', 'Sparta', 'Corinth', 'Athens'],
    optionsHe: ['סלוניקי', 'ספרטה', 'קורינתוס', 'אתונה'],
    correctIndex: 3,
    funFact: 'Lycabettus Hill at 277 m is the highest point in Athens. On clear days you can see the Saronic Gulf and even Aegina Island from the top!',
    funFactHe: 'גבעת לוקבטוס בגובה 277 מ\' היא הנקודה הגבוהה ביותר באתונה. בימים בהירים ניתן לראות את המפרץ הסרוני ואפילו את האי אייגינה מהפסגה!',
  },

  // ══════════════════════ DAY 2 — Cape Sounion / Delphi ══════════════════════
  {
    id: 'q3',
    dayIndex: 2,
    question: 'What is the national dish of Greece?',
    questionHe: 'מהו המאכל הלאומי של יוון?',
    options: ['Pasta', 'Moussaka', 'Paella', 'Sushi'],
    optionsHe: ['פסטה', 'מוסקה', 'פאייה', 'סושי'],
    correctIndex: 1,
    funFact: 'Moussaka is a layered dish of eggplant, minced meat, and bechamel sauce, baked to perfection!',
    funFactHe: 'מוסקה הוא מאכל שכבות של חציל, בשר טחון ורוטב בשמל, אפוי לשלמות!',
  },
  {
    id: 'q3b',
    dayIndex: 2,
    question: 'The ancient site of Delphi was known as what?',
    questionHe: 'האתר העתיק של דלפי היה ידוע בשם מה?',
    options: ['The Gate of Olympus', 'The Navel of the World', 'The Shrine of Ares', 'The Center of Knowledge'],
    optionsHe: ['שער האולימפוס', 'טבור העולם', 'מקדש אארס', 'מרכז הידע'],
    correctIndex: 1,
    funFact: 'The ancient Greeks believed Delphi was the center of the world (omphalos = navel). A stone called the Omphalos marked this sacred spot!',
    funFactHe: 'היוונים העתיקים האמינו שדלפי הוא מרכז העולם (אומפלוס = טבור). אבן הנקראת אומפלוס סימנה את המקום הקדוש הזה!',
  },
  {
    id: 'q3c',
    dayIndex: 2,
    question: 'The Temple of Poseidon at Cape Sounion overlooks which body of water?',
    questionHe: 'מקדש פוסידון בקייפ סוניון מביט על איזה גוף מים?',
    options: ['The Ionian Sea', 'The Adriatic Sea', 'The Aegean Sea', 'The Mediterranean Sea'],
    optionsHe: ['הים היוני', 'הים האדריאטי', 'הים האגאי', 'הים התיכון'],
    correctIndex: 2,
    funFact: 'The Temple of Poseidon at Cape Sounion (444-440 BC) provided ancient sailors their last sight of Athens — and their first on return. Lord Byron carved his name on a column!',
    funFactHe: 'מקדש פוסידון בקייפ סוניון (444-440 לפנה"ס) סיפק לימאים עתיקים את מראה אתונה האחרון שלהם — והראשון בשובם. לורד ביירון חרת את שמו על עמוד!',
  },
  {
    id: 'q3d',
    dayIndex: 2,
    question: 'The Oracle of Delphi served which Greek god?',
    questionHe: 'נביאת דלפי שרתה איזה אל יווני?',
    options: ['Zeus', 'Hermes', 'Apollo', 'Dionysus'],
    optionsHe: ['זאוס', 'הרמס', 'אפולו', 'דיוניסוס'],
    correctIndex: 2,
    funFact: 'The Oracle (Pythia) at Delphi channeled the god Apollo. Kings, generals, and commoners traveled from across the known world to seek her prophecies!',
    funFactHe: 'הנביאה (פיתיה) בדלפי ערצה את האל אפולו. מלכים, גנרלים ואנשים פשוטים נסעו מכל העולם הידוע לבקש נבואותיה!',
  },
  {
    id: 'q3e',
    dayIndex: 2,
    question: 'How far is Cape Sounion from Athens?',
    questionHe: 'כמה רחוק קייפ סוניון מאתונה?',
    options: ['20 km', '50 km', '70 km', '120 km'],
    optionsHe: ['20 ק"מ', '50 ק"מ', '70 ק"מ', '120 ק"מ'],
    correctIndex: 2,
    funFact: 'Cape Sounion is about 70 km south of Athens along the stunning Athens Riviera coast road — perfect for a half-day trip!',
    funFactHe: 'קייפ סוניון נמצא כ-70 ק"מ דרומית לאתונה לאורך כביש חוף הריביירה המרהיב — מושלם לטיול חצי יום!',
  },

  // ══════════════════════ DAY 3 — Meteora ══════════════════════
  {
    id: 'q4',
    dayIndex: 3,
    question: 'Who is the king of the Greek gods in mythology?',
    questionHe: 'מי הוא מלך האלים במיתולוגיה היוונית?',
    options: ['Poseidon', 'Hades', 'Zeus', 'Apollo'],
    optionsHe: ['פוסידון', 'האדס', 'זאוס', 'אפולו'],
    correctIndex: 2,
    funFact: 'Zeus ruled from Mount Olympus and was known for throwing lightning bolts! He was married to Hera but famously had many affairs.',
    funFactHe: 'זאוס שלט מהר אולימפוס והיה ידוע בזריקת ברקים! הוא היה נשוי להרה אבל בצורה מפורסמת היו לו הרבה פרשיות.',
  },
  {
    id: 'q4b',
    dayIndex: 3,
    question: 'What does "Meteora" mean in Greek?',
    questionHe: 'מה פירוש "מטאורה" ביוונית?',
    options: ['Ancient rocks', 'Suspended in the air', 'Holy mountain', 'Wind towers'],
    optionsHe: ['סלעים עתיקים', 'תלוי באוויר', 'הר קדוש', 'מגדלי רוח'],
    correctIndex: 1,
    funFact: '"Meteora" means "suspended in the air" or "in the heavens above" — perfectly describing the monasteries perched atop giant rock pillars up to 400 metres high!',
    funFactHe: '"מטאורה" פירושה "תלוי באוויר" או "בשמים מעל" — מתאר בצורה מושלמת את המנזרים השוכנים על גבי עמודי סלע ענקיים בגובה עד 400 מטר!',
  },
  {
    id: 'q4c',
    dayIndex: 3,
    question: 'How many monasteries remain accessible at Meteora today?',
    questionHe: 'כמה מנזרים נגישים היום במטאורה?',
    options: ['24', '12', '6', '3'],
    optionsHe: ['24', '12', '6', '3'],
    correctIndex: 2,
    funFact: 'Of the original 24 monasteries built at Meteora, only 6 remain active today. At their peak in the 16th century, all 24 were thriving monastic communities!',
    funFactHe: 'מתוך 24 המנזרים המקוריים שנבנו במטאורה, רק 6 פעילים היום. בשיאם במאה ה-16, כל 24 היו קהילות נזירות משגשגות!',
  },
  {
    id: 'q4d',
    dayIndex: 3,
    question: 'When did Meteora become a UNESCO World Heritage Site?',
    questionHe: 'מתי הפכה מטאורה לאתר מורשת עולמית של אונסקו?',
    options: ['1972', '1988', '2000', '2010'],
    optionsHe: ['1972', '1988', '2000', '2010'],
    correctIndex: 1,
    funFact: 'Meteora was inscribed as a UNESCO World Heritage Site in 1988 for both its natural and cultural significance. It also appeared in the James Bond film "For Your Eyes Only"!',
    funFactHe: 'מטאורה נרשמה כאתר מורשת עולמית של אונסקו ב-1988 בגלל משמעותה הטבעית והתרבותית כאחד. היא גם הופיעה בסרט ג\'יימס בונד "רק עבור עיניך"!',
  },
  {
    id: 'q4e',
    dayIndex: 3,
    question: 'Kalambaka is the town at the base of which famous site?',
    questionHe: 'קלמבקה היא העיירה שבבסיס איזה אתר מפורסם?',
    options: ['Delphi', 'Olympia', 'Meteora', 'Thermopylae'],
    optionsHe: ['דלפי', 'אולימפיה', 'מטאורה', 'תרמופלאי'],
    correctIndex: 2,
    funFact: 'Kalambaka (population ~12,000) serves as the main gateway to Meteora. Its old Byzantine church of the Dormition of the Virgin dates to the 11th century!',
    funFactHe: 'קלמבקה (אוכלוסייה ~12,000) משמשת כשער הראשי למטאורה. הכנסייה הביזנטינית הישנה שלה מהמאה ה-11!',
  },

  // ══════════════════════ DAY 4 — Central Greece ══════════════════════
  {
    id: 'q5',
    dayIndex: 4,
    question: 'What sea lies to the east of mainland Greece?',
    questionHe: 'איזה ים נמצא ממזרח ליוון?',
    options: ['Mediterranean Sea', 'Black Sea', 'Aegean Sea', 'Adriatic Sea'],
    optionsHe: ['הים התיכון', 'הים השחור', 'הים האגאי', 'הים האדריאטי'],
    correctIndex: 2,
    funFact: 'The Aegean Sea is home to over 2,000 islands and has been a cradle of civilization for millennia!',
    funFactHe: 'הים האגאי הוא ביתם של מעל 2,000 איים והיה עריסת ציוויליזציה במשך אלפי שנים!',
  },
  {
    id: 'q5b',
    dayIndex: 4,
    question: 'What sea lies to the west of mainland Greece?',
    questionHe: 'איזה ים נמצא ממערב ליוון?',
    options: ['Aegean Sea', 'Adriatic Sea', 'Ionian Sea', 'Tyrrhenian Sea'],
    optionsHe: ['הים האגאי', 'הים האדריאטי', 'הים היוני', 'הים הטירהני'],
    correctIndex: 2,
    funFact: 'The Ionian Sea to the west of Greece contains some of the world\'s clearest water. The islands there (Corfu, Zakynthos, Kefalonia) are famous for their lush green landscapes!',
    funFactHe: 'הים היוני ממערב ליוון מכיל מהמים הצלולים ביותר בעולם. האיים שם (קורפו, זקינתוס, קפלוניה) מפורסמים בנופיהם הירוקים!',
  },
  {
    id: 'q5c',
    dayIndex: 4,
    question: 'What is the height of Mount Olympus, Greece\'s highest peak?',
    questionHe: 'מהו גובה הר אולימפוס, הפסגה הגבוהה ביותר ביוון?',
    options: ['1,917 m', '2,917 m', '3,917 m', '4,917 m'],
    optionsHe: ['1,917 מ\'', '2,917 מ\'', '3,917 מ\'', '4,917 מ\''],
    correctIndex: 1,
    funFact: 'Mount Olympus reaches 2,917 m and was believed by the ancient Greeks to be the home of the twelve Olympian gods. It\'s now a National Park and UNESCO Biosphere Reserve!',
    funFactHe: 'הר אולימפוס מגיע ל-2,917 מ\' והיווני העתיק האמין שזה ביתם של שנים עשר האלים האולימפיים. כיום הוא פארק לאומי ושמורת ביוספרה של אונסקו!',
  },
  {
    id: 'q5d',
    dayIndex: 4,
    question: 'The Battle of Thermopylae featured which legendary group of 300 warriors?',
    questionHe: 'קרב תרמופלאי כלל איזה קבוצה אגדית של 300 לוחמים?',
    options: ['Athenians', 'Macedonians', 'Spartans', 'Corinthians'],
    optionsHe: ['אתנאים', 'מקדונים', 'ספרטנים', 'קורינתיים'],
    correctIndex: 2,
    funFact: 'In 480 BC, King Leonidas of Sparta led 300 Spartan warriors (and ~7,000 Greeks) against the Persian army. Their legendary stand is commemorated by the film "300"!',
    funFactHe: 'ב-480 לפנה"ס, המלך לאונידס מספרטה הוביל 300 לוחמים ספרטנים (וכ-7,000 יוונים) נגד הצבא הפרסי. עמידתם האגדית מונצחת בסרט "300"!',
  },
  {
    id: 'q5e',
    dayIndex: 4,
    question: 'What connects the Aegean and Ionian Seas by cutting through mainland Greece?',
    questionHe: 'מה מחבר בין הים האגאי לים היוני על ידי חציית יוון?',
    options: ['The Thessaly Canal', 'The Athos Waterway', 'The Corinth Canal', 'The Delphi Pass'],
    optionsHe: ['תעלת תסליה', 'מפלס אתוס', 'תעלת קורינתוס', 'מעבר דלפי'],
    correctIndex: 2,
    funFact: 'The Corinth Canal (completed 1893) is 6.4 km long and only 21.3 m wide — so narrow that today only small vessels and cruise ships specially equipped can use it!',
    funFactHe: 'תעלת קורינתוס (הושלמה ב-1893) באורך 6.4 ק"מ ורוחב 21.3 מ\' בלבד — כל כך צרה שכיום רק כלי שייט קטנים וספינות שייט מצוידות במיוחד יכולות להשתמש בה!',
  },

  // ══════════════════════ DAY 5 — Santorini arrival ══════════════════════
  {
    id: 'q6',
    dayIndex: 5,
    question: 'What is the famous white-and-blue island often seen on postcards?',
    questionHe: 'מהו האי הלבן-כחול המפורסם שנראה לעיתים על גלויות?',
    options: ['Crete', 'Mykonos', 'Santorini', 'Rhodes'],
    optionsHe: ['כרתים', 'מיקונוס', 'סנטוריני', 'רודוס'],
    correctIndex: 2,
    funFact: 'Santorini was formed by a massive volcanic eruption around 1600 BC that may have inspired the legend of Atlantis!',
    funFactHe: 'סנטוריני נוצרה מהתפרצות געשית עצומה בסביבות 1600 לפנה"ס שאולי השרתה את האגדה של אטלנטיס!',
  },
  {
    id: 'q6b',
    dayIndex: 5,
    question: 'What is the name of Santorini\'s most famous village, known for sunsets?',
    questionHe: 'מה שמה של הכפר המפורסם ביותר בסנטוריני, הידוע בשקיעות שלו?',
    options: ['Fira', 'Oia', 'Perissa', 'Kamari'],
    optionsHe: ['פירה', 'איה', 'פריסה', 'קמרי'],
    correctIndex: 1,
    funFact: 'Oia (pronounced "Ee-ah") is famous for having the most photographed sunset in the world. Crowds gather every evening on the castle ruins to watch the sun dip into the caldera!',
    funFactHe: 'איה (מבוטא "איה") מפורסמת בכך שיש בה השקיעה המצולמת ביותר בעולם. המונים מתאספים בכל ערב על חורבות הטירה לצפות בשמש שוקעת לתוך הקלדרה!',
  },
  {
    id: 'q6c',
    dayIndex: 5,
    question: 'What is Santorini\'s signature local wine grape variety?',
    questionHe: 'מהי זן ענב היין המקומי האופייני של סנטוריני?',
    options: ['Muscat', 'Assyrtiko', 'Moschofilero', 'Agiorgitiko'],
    optionsHe: ['מוסקט', 'אסירטיקו', 'מוסכופילרו', 'אגיורגיטיקו'],
    correctIndex: 1,
    funFact: 'Assyrtiko is a crisp, mineral white wine grown in Santorini\'s volcanic soil. The vines are trained in a basket shape (kouloura) to protect them from the fierce winds!',
    funFactHe: 'אסירטיקו הוא יין לבן חד ומינרלי הגדל באדמה הוולקנית של סנטוריני. הגפנים מאומנות בצורת סל (קולורה) כדי להגן עליהן מפני הרוחות החזקות!',
  },
  {
    id: 'q6d',
    dayIndex: 5,
    question: 'Santorini sits in the middle of a large flooded what?',
    questionHe: 'סנטוריני יושבת באמצע איזה דבר גדול ומוצף?',
    options: ['Lagoon', 'Crater lake', 'Caldera', 'Bay'],
    optionsHe: ['לגונה', 'אגם קלדרה', 'קלדרה', 'מפרץ'],
    correctIndex: 2,
    funFact: 'The stunning crescent shape of Santorini is the rim of a massive caldera — the collapsed heart of a supervolcano that erupted around 1600 BC in one of history\'s largest eruptions!',
    funFactHe: 'הצורה המרהיבה של סנטוריני בצורת סהר היא שפת קלדרה ענקית — לב מכרה שקרס של סופרוולקן שהתפרץ בסביבות 1600 לפנה"ס באחת ההתפרצויות הגדולות ביותר בהיסטוריה!',
  },
  {
    id: 'q6e',
    dayIndex: 5,
    question: 'What is the ancient name of the island now called Santorini?',
    questionHe: 'מה השם העתיק של האי הנקרא כיום סנטוריני?',
    options: ['Thira', 'Mykonos', 'Delos', 'Naxos'],
    optionsHe: ['תירה', 'מיקונוס', 'דלוס', 'נקסוס'],
    correctIndex: 0,
    funFact: 'The island\'s ancient name is Thira (Thera). "Santorini" comes from "Santa Irini" — the name Venetian sailors gave it in the 13th century after the local church of Saint Irene!',
    funFactHe: 'השם העתיק של האי הוא תירה (תרה). "סנטוריני" מגיע מ"סנטה איריני" — השם שנתנו לו ימאים ונציאנים במאה ה-13 על שם כנסיית סנט איריין המקומית!',
  },

  // ══════════════════════ DAY 6 — Santorini exploration ══════════════════════
  {
    id: 'q7',
    dayIndex: 6,
    question: 'What ancient structure sits atop the Acropolis in Athens?',
    questionHe: 'איזה מבנה עתיק יושב על גבי האקרופוליס באתונה?',
    options: ['Colosseum', 'Parthenon', 'Stonehenge', 'Pyramids'],
    optionsHe: ['הקולוסאום', 'הפרתנון', 'סטונהנג\'', 'הפירמידות'],
    correctIndex: 1,
    funFact: 'The Parthenon was built in 447-432 BC as a temple to the goddess Athena and once housed a giant gold-and-ivory statue of her!',
    funFactHe: 'הפרתנון נבנה בשנים 447-432 לפנה"ס כמקדש לאלה אתנה ופעם אירח פסל ענק שלה מזהב ושנהב!',
  },
  {
    id: 'q7b',
    dayIndex: 6,
    question: 'What Greek spirit is made from distilled grape marc (pomace)?',
    questionHe: 'איזה משקה אלכוהולי יווני מיוצר מזוגג ענבים מסחוטים?',
    options: ['Ouzo', 'Mastiha', 'Tsipouro', 'Metaxa'],
    optionsHe: ['אוזו', 'מסטיחה', 'טסיפורו', 'מטקסה'],
    correctIndex: 2,
    funFact: 'Tsipouro (also called tsikoudia in Crete) is a strong Greek pomace brandy, similar to Italian grappa. It\'s traditionally served with small snacks called mezedes!',
    funFactHe: 'טסיפורו (הנקרא גם צקודיה בכרתים) הוא ברנדי פומס יווני חזק, דומה לגראפה האיטלקית. הוא מוגש מסורתית עם חטיפים קטנים הנקראים מזדות!',
  },
  {
    id: 'q7c',
    dayIndex: 6,
    question: 'What is "ouzo" flavoured with?',
    questionHe: 'במה מתובל "אוזו"?',
    options: ['Lemon and mint', 'Grape and fig', 'Anise and herbs', 'Olive and thyme'],
    optionsHe: ['לימון ונענע', 'ענב ותאנה', 'אניס ועשבים', 'זית ותימין'],
    correctIndex: 2,
    funFact: 'Ouzo turns milky white when water or ice is added — this is called the "ouzo effect" or louche. It is the national spirit of Greece, protected by EU law!',
    funFactHe: 'אוזו הופך לבן חלבי כאשר מוסיפים מים או קרח — זה נקרא "אפקט האוזו". הוא המשקה הלאומי של יוון, מוגן על פי חוק האיחוד האירופי!',
  },
  {
    id: 'q7d',
    dayIndex: 6,
    question: 'The legendary Atlantis was possibly inspired by the eruption of which island?',
    questionHe: 'אגדת אטלנטיס השרתה אולי על ידי התפרצות של איזה אי?',
    options: ['Mykonos', 'Rhodes', 'Santorini (Thera)', 'Crete'],
    optionsHe: ['מיקונוס', 'רודוס', 'סנטוריני (תרה)', 'כרתים'],
    correctIndex: 2,
    funFact: 'Many historians believe Plato\'s Atlantis story was inspired by the Minoan civilization\'s catastrophic destruction when Thera (Santorini) erupted around 1600 BC!',
    funFactHe: 'היסטוריונים רבים מאמינים שסיפור האטלנטיס של אפלטון הושרה על ידי ההרס הקטסטרופלי של הציוויליזציה המינואית כאשר תרה (סנטוריני) התפרצה בסביבות 1600 לפנה"ס!',
  },
  {
    id: 'q7e',
    dayIndex: 6,
    question: 'What colour are the domes of the most iconic churches in Oia, Santorini?',
    questionHe: 'איזה צבע יש לכיפות של הכנסיות האיקוניות ביותר באיה, סנטוריני?',
    options: ['White', 'Blue', 'Gold', 'Red'],
    optionsHe: ['לבן', 'כחול', 'זהב', 'אדום'],
    correctIndex: 1,
    funFact: 'The iconic blue-domed churches of Santorini were whitewashed and painted blue under a Greek junta decree in the 1970s to match the national flag colors!',
    funFactHe: 'הכנסיות בעלות הכיפות הכחולות האיקוניות של סנטוריני הולבנו וצוירו בכחול בצו של היונטה היוונית בשנות ה-70 כדי להתאים לצבעי הדגל הלאומי!',
  },

  // ══════════════════════ DAY 7 — Crete arrival ══════════════════════
  {
    id: 'q8',
    dayIndex: 7,
    question: 'What is tzatziki made from?',
    questionHe: 'ממה מכינים צזיקי?',
    options: ['Tomatoes and basil', 'Yogurt and cucumber', 'Cheese and olives', 'Lemon and honey'],
    optionsHe: ['עגבניות ובזיליקום', 'יוגורט ומלפפון', 'גבינה וזיתים', 'לימון ודבש'],
    correctIndex: 1,
    funFact: 'Tzatziki is made with strained yogurt, cucumber, garlic, olive oil, and herbs. It is served with almost every Greek meal!',
    funFactHe: 'צזיקי מוכן מיוגורט מסונן, מלפפון, שום, שמן זית ועשבי תיבול. הוא מוגש כמעט עם כל ארוחה יוונית!',
  },
  {
    id: 'q8b',
    dayIndex: 7,
    question: 'What is the largest city on the island of Crete?',
    questionHe: 'מהי העיר הגדולה ביותר באי כרתים?',
    options: ['Chania', 'Rethymno', 'Heraklion', 'Agios Nikolaos'],
    optionsHe: ['חניה', 'רתימנו', 'הרקליון', 'אגיוס ניקולאוס'],
    correctIndex: 2,
    funFact: 'Heraklion (Iraklio) is the largest city of Crete and the 5th largest city in Greece. It\'s home to the Palace of Knossos and the superb Archaeological Museum!',
    funFactHe: 'הרקליון הוא העיר הגדולה ביותר בכרתים ועיר החמישית בגודלה ביוון. היא מקימת את ארמון קנוסוס ומוזיאון הארכיאולוגיה המעולה!',
  },
  {
    id: 'q8c',
    dayIndex: 7,
    question: 'The Minoan Palace of Knossos is located near which city?',
    questionHe: 'ארמון קנוסוס המינואי ממוקם ליד איזו עיר?',
    options: ['Chania', 'Heraklion', 'Rethymno', 'Ierapetra'],
    optionsHe: ['חניה', 'הרקליון', 'רתימנו', 'יראפטרה'],
    correctIndex: 1,
    funFact: 'Knossos was the centre of the Minoan civilization (Europe\'s first), dating back to 7000 BC. The legendary Minotaur was said to dwell in the labyrinth beneath the palace!',
    funFactHe: 'קנוסוס היה מרכז הציוויליזציה המינואית (הראשונה באירופה), עד 7000 לפנה"ס. מינוטאורוס האגדי אמר לשכון במבוך מתחת לארמון!',
  },
  {
    id: 'q8d',
    dayIndex: 7,
    question: 'Crete is approximately how long from east to west?',
    questionHe: 'כרתים בערך באיזה אורך ממזרח למערב?',
    options: ['80 km', '160 km', '260 km', '400 km'],
    optionsHe: ['80 ק"מ', '160 ק"מ', '260 ק"מ', '400 ק"מ'],
    correctIndex: 2,
    funFact: 'Crete is about 260 km long but only 12-60 km wide — the southernmost island of Greece and one of the southernmost points in Europe!',
    funFactHe: 'כרתים באורך כ-260 ק"מ אך רק 12-60 ק"מ ברוחב — האי הדרומי ביותר של יוון ואחת הנקודות הדרומיות ביותר באירופה!',
  },
  {
    id: 'q8e',
    dayIndex: 7,
    question: 'What is Crete\'s cuisine especially known for?',
    questionHe: 'במה ידועה הקuisine של כרתים במיוחד?',
    options: ['Spicy peppers', 'High-quality olive oil and fresh herbs', 'Seafood only', 'Aged cheeses'],
    optionsHe: ['פלפלים חריפים', 'שמן זית איכותי ועשבים טריים', 'פירות ים בלבד', 'גבינות מיושנות'],
    correctIndex: 1,
    funFact: 'The Cretan diet is considered one of the healthiest in the world — rich in olive oil, wild greens (horta), legumes, herbs, and fresh vegetables. It\'s the foundation of the Mediterranean diet!',
    funFactHe: 'הדיאטה הכרתית נחשבת לאחת הבריאות בעולם — עשירה בשמן זית, ירק פראי (חורטה), קטניות, עשבים וירקות טריים. היא הבסיס לדיאטה הים תיכונית!',
  },

  // ══════════════════════ DAY 8 — Crete exploration ══════════════════════
  {
    id: 'q9',
    dayIndex: 8,
    question: 'What were the ancient Olympic Games held to honor?',
    questionHe: 'לכבוד מי נערכו המשחקים האולימפיים העתיקים?',
    options: ['Athena', 'Poseidon', 'Zeus', 'Hermes'],
    optionsHe: ['אתנה', 'פוסידון', 'זאוס', 'הרמס'],
    correctIndex: 2,
    funFact: 'The ancient Olympics started in 776 BC in Olympia, Greece, and athletes competed completely naked!',
    funFactHe: 'האולימפיאדה העתיקה החלה ב-776 לפנה"ס באולימפיה, יוון, והספורטאים התחרו עירומים לחלוטין!',
  },
  {
    id: 'q9b',
    dayIndex: 8,
    question: 'The Samaria Gorge in Crete holds which European record?',
    questionHe: 'מה מחזיק תקן אירופאי עבור גיא שמריה בכרתים?',
    options: ['Widest gorge', 'Longest gorge', 'Deepest gorge', 'Highest gorge'],
    optionsHe: ['הגיא הרחב ביותר', 'הגיא הארוך ביותר', 'הגיא העמוק ביותר', 'הגיא הגבוה ביותר'],
    correctIndex: 1,
    funFact: 'Samaria Gorge is 16 km long — the longest gorge in Europe! It takes 4-7 hours to hike through. At its narrowest point (Iron Gates), the walls are just 3 metres apart!',
    funFactHe: 'גיא שמריה הוא 16 ק"מ — הגיא הארוך ביותר באירופה! לוקח 4-7 שעות לטייל בו. בנקודתו הצרה ביותר (שערי הברזל), הקירות נמצאים רק 3 מטר זה מזה!',
  },
  {
    id: 'q9c',
    dayIndex: 8,
    question: 'What colour is the sand at Elafonissi beach in Crete?',
    questionHe: 'איזה צבע יש לחול בחוף אלפוניסי בכרתים?',
    options: ['Black volcanic sand', 'Pink', 'Golden yellow', 'White'],
    optionsHe: ['חול שחור וולקני', 'ורוד', 'צהוב זהוב', 'לבן'],
    correctIndex: 1,
    funFact: 'Elafonissi beach has famous pinkish sand created by crushed seashells and coral mixed with white sand. It\'s one of the most photographed beaches in the Mediterranean!',
    funFactHe: 'חוף אלפוניסי כולל חול ורדרד מפורסם שנוצר על ידי קונכיות ואלמוגים כתושים המעורבים עם חול לבן. הוא אחד החופים המצולמים ביותר בים התיכון!',
  },
  {
    id: 'q9d',
    dayIndex: 8,
    question: 'How long was Crete under Venetian rule?',
    questionHe: 'כמה זמן הייתה כרתים תחת שלטון ונציה?',
    options: ['~100 years', '~250 years', '~465 years', '~600 years'],
    optionsHe: ['~100 שנה', '~250 שנה', '~465 שנה', '~600 שנה'],
    correctIndex: 2,
    funFact: 'Crete was under Venetian rule from 1204 to 1669 — about 465 years. The Venetians left remarkable fortresses, ports, and architecture, especially in Chania and Rethymno!',
    funFactHe: 'כרתים הייתה תחת שלטון ונציה מ-1204 עד 1669 — כ-465 שנה. הוונציאנים השאירו מבצרים, נמלים ואדריכלות מרהיבים, במיוחד בחניה וברתימנו!',
  },
  {
    id: 'q9e',
    dayIndex: 8,
    question: 'What is the traditional Cretan spirit, similar to grappa?',
    questionHe: 'מהו המשקה הכרתי המסורתי, הדומה לגראפה?',
    options: ['Ouzo', 'Raki / Tsikoudia', 'Tsipouro', 'Metaxa'],
    optionsHe: ['אוזו', 'ראקי / צקודיה', 'טסיפורו', 'מטקסה'],
    correctIndex: 1,
    funFact: 'Raki (or tsikoudia) is Crete\'s own pomace spirit, distilled from grape skins after winemaking. Every taverna will offer you a small glass — often free — at the end of a meal!',
    funFactHe: 'ראקי (או צקודיה) הוא המשקה הכרתי משלל ענבים, מזוקק מקליפות ענבים לאחר ייצור יין. כל טברנה תציע לך כוס קטנה — לעתים קרובות חינם — בסוף הארוחה!',
  },

  // ══════════════════════ DAY 9 — Nafplio / Peloponnese ══════════════════════
  {
    id: 'q10',
    dayIndex: 9,
    question: 'What is the largest Greek island?',
    questionHe: 'מהו האי היווני הגדול ביותר?',
    options: ['Rhodes', 'Corfu', 'Crete', 'Santorini'],
    optionsHe: ['רודוס', 'קורפו', 'כרתים', 'סנטוריני'],
    correctIndex: 2,
    funFact: 'Crete is the 5th largest island in the Mediterranean and was home to the ancient Minoan civilization — Europe\'s first advanced civilization!',
    funFactHe: 'כרתים הוא האי החמישי בגודלו בים התיכון והיה ביתה של הציוויליזציה המינואית — הציוויליזציה המתקדמת הראשונה באירופה!',
  },
  {
    id: 'q10b',
    dayIndex: 9,
    question: 'Nafplio was the first capital of what?',
    questionHe: 'נאפליון הייתה עיר הבירה הראשונה של מה?',
    options: ['Ancient Macedonia', 'The Byzantine Empire', 'Modern Greece', 'The Peloponnese region'],
    optionsHe: ['מקדוניה העתיקה', 'האימפריה הביזנטית', 'יוון המודרנית', 'אזור הפלופונסוס'],
    correctIndex: 2,
    funFact: 'Nafplio served as the first capital of independent modern Greece from 1828 to 1834, before the capital moved to Athens. It\'s a beautifully preserved neoclassical town!',
    funFactHe: 'נאפליון שימשה כעיר הבירה הראשונה של יוון המודרנית העצמאית מ-1828 עד 1834, לפני שעיר הבירה עברה לאתונה. זוהי עיירה נאוקלאסית שמורה יפה!',
  },
  {
    id: 'q10c',
    dayIndex: 9,
    question: 'The ancient Theatre of Epidaurus is famous for what acoustic feature?',
    questionHe: 'התיאטרון העתיק של אפידאורוס מפורסם בשל תכונה אקוסטית איזו?',
    options: ['Its echo chambers', 'Perfect acoustics — a whisper on stage can be heard in the last row', 'Its amplifying dome', 'Surrounding waterfalls that carry sound'],
    optionsHe: ['חדרי הדהוד שלו', 'אקוסטיקה מושלמת — לחישה על הבמה נשמעת בשורה האחרונה', 'כיפת ההגברה שלו', 'מפלי מים שנושאים קול'],
    correctIndex: 1,
    funFact: 'Epidaurus Theatre (4th century BC) seats 14,000 people and has such perfect acoustics that a coin dropped on stage can be heard from the top row — 300 metres away!',
    funFactHe: 'תיאטרון אפידאורוס (המאה ה-4 לפנה"ס) יושב 14,000 אנשים ויש לו אקוסטיקה כל כך מושלמת שמטבע שנשמט על הבמה נשמע מהשורה העליונה — 300 מ\' הרחק!',
  },
  {
    id: 'q10d',
    dayIndex: 9,
    question: 'How many steps lead up to the Palamidi Fortress in Nafplio?',
    questionHe: 'כמה מדרגות מובילות למבצר פלמידי בנאפליון?',
    options: ['~350', '~600', '~999', '~1,500'],
    optionsHe: ['~350', '~600', '~999', '~1,500'],
    correctIndex: 2,
    funFact: 'The Palamidi Fortress has a legendary 999 steps (actually 857!) carved into the rock by the Venetians in 1714. The views from the top over Nafplio and the Argolic Gulf are breathtaking!',
    funFactHe: 'למבצר פלמידי יש 999 מדרגות אגדיות (למעשה 857!) חצובות בסלע על ידי הוונציאנים ב-1714. הנוף מהפסגה על נאפליון ומפרץ ארגוליקוס מדהים!',
  },
  {
    id: 'q10e',
    dayIndex: 9,
    question: 'In which ancient city was Helen of Troy — whose beauty launched a thousand ships — said to be queen?',
    questionHe: 'באיזו עיר עתיקה נאמר שהלנה מטרויה — שיופיה שלח אלף ספינות — הייתה מלכה?',
    options: ['Corinth', 'Mycenae', 'Sparta', 'Argos'],
    optionsHe: ['קורינתוס', 'מיקנאה', 'ספרטה', 'ארגוס'],
    correctIndex: 2,
    funFact: 'Helen was Queen of Sparta, wife of King Menelaus. When she ran off with (or was taken by) Paris of Troy, it triggered the legendary Trojan War that lasted 10 years!',
    funFactHe: 'הלנה הייתה מלכת ספרטה, אשתו של המלך מנלאוס. כאשר ברחה עם (או נלקחה על ידי) פריס מטרויה, זה הצית את מלחמת טרויה האגדית שנמשכה 10 שנים!',
  },

  // ══════════════════════ DAY 10 — Olympia ══════════════════════
  {
    id: 'q11',
    dayIndex: 10,
    question: 'What is the traditional Greek coffee served in?',
    questionHe: 'במה מוגש קפה יווני מסורתי?',
    options: ['A tall glass', 'A small cup (demitasse)', 'A bowl', 'A mug'],
    optionsHe: ['כוס גבוהה', 'כוס קטנה (דמיטס)', 'קערה', 'ספל'],
    correctIndex: 1,
    funFact: 'Greek coffee is brewed in a briki (small pot) and served unfiltered in a demitasse cup. The grounds settle at the bottom — never drink the last sip!',
    funFactHe: 'קפה יווני מבושל בבריקי (סיר קטן) ומוגש ללא סינון בכוס דמיטס. השאריות שוקעות לתחתית — לעולם אל תשתו את הלגימה האחרונה!',
  },
  {
    id: 'q11b',
    dayIndex: 10,
    question: 'How often were the ancient Olympic Games held?',
    questionHe: 'כמה פעמים נערכו המשחקים האולימפיים העתיקים?',
    options: ['Every year', 'Every 2 years', 'Every 4 years', 'Every 8 years'],
    optionsHe: ['כל שנה', 'כל 2 שנים', 'כל 4 שנים', 'כל 8 שנים'],
    correctIndex: 2,
    funFact: 'The ancient Olympics were held every 4 years (Olympiad). They were so important that even wars were paused for a sacred truce (Ekecheiria) during the games!',
    funFactHe: 'האולימפיאדה העתיקה נערכה כל 4 שנים. הם היו כל כך חשובים שאפילו מלחמות הוקפאו לפסק קדוש (אקכיריה) במהלך המשחקים!',
  },
  {
    id: 'q11c',
    dayIndex: 10,
    question: 'The ancient Statue of Zeus at Olympia was one of what?',
    questionHe: 'פסל זאוס העתיק באולימפיה היה אחד ממה?',
    options: ['The Ten Myths of Greece', 'The Seven Wonders of the Ancient World', 'The Twelve Labors of Hercules', 'The Five Olympic Traditions'],
    optionsHe: ['עשרת האגדות של יוון', 'שבעת פלאי העולם העתיק', 'שנים עשר עמלי הרקולס', 'חמש מסורות האולימפי'],
    correctIndex: 1,
    funFact: 'The Statue of Zeus at Olympia was 12 meters tall, made of ivory and gold, and created by the sculptor Phidias around 435 BC. It is now lost to history.',
    funFactHe: 'פסל זאוס באולימפיה היה בגובה 12 מטר, עשוי שנהב וזהב, ונוצר על ידי הפסל פידיאס בסביבות 435 לפנה"ס. הוא כעת אבוד להיסטוריה.',
  },
  {
    id: 'q11d',
    dayIndex: 10,
    question: 'Who was the legendary hero who performed 12 labors?',
    questionHe: 'מי היה הגיבור האגדי שביצע 12 עמלים?',
    options: ['Achilles', 'Perseus', 'Hercules (Heracles)', 'Odysseus'],
    optionsHe: ['אכילס', 'פרסאוס', 'הרקולס (הרקלס)', 'אודיסאוס'],
    correctIndex: 2,
    funFact: 'Heracles (Hercules) was assigned 12 impossible labors by King Eurystheus. One of them — the Augean stables — was carried out near Olympia! His father was Zeus.',
    funFactHe: 'הרקלס (הרקולס) קיבל 12 עמלים בלתי אפשריים מהמלך אאוריסתאוס. אחד מהם — אורוות אוגיאס — בוצע ליד אולימפיה! אביו היה זאוס.',
  },
  {
    id: 'q11e',
    dayIndex: 10,
    question: 'What is the Peloponnese connected to mainland Greece by?',
    questionHe: 'במה מחובר הפלופונסוס ליוון?',
    options: ['A long bridge', 'The Isthmus of Corinth', 'A ferry route', 'An undersea tunnel'],
    optionsHe: ['גשר ארוך', 'צוואר הבקבוק של קורינתוס', 'קו מעבורת', 'מנהרה תת-ימית'],
    correctIndex: 1,
    funFact: 'The Peloponnese is connected to mainland Greece by the narrow Isthmus of Corinth — now sliced by the Corinth Canal. The Rio-Antirrio bridge (2004) also crosses the Gulf of Corinth!',
    funFactHe: 'הפלופונסוס מחובר ליוון על ידי צוואר הבקבוק הצר של קורינתוס — כיום חצוי על ידי תעלת קורינתוס. גשר ריו-אנטיריו (2004) גם חוצה את מפרץ קורינתוס!',
  },

  // ══════════════════════ DAY 11 — Return to Athens ══════════════════════
  {
    id: 'q12',
    dayIndex: 11,
    question: 'What does "Opa!" mean in Greek culture?',
    questionHe: 'מה המשמעות של "אופה!" בתרבות היוונית?',
    options: [
      'Sorry',
      'An exclamation of joy and celebration',
      'Goodbye',
      'Please',
    ],
    optionsHe: [
      'סליחה',
      'קריאת שמחה וחגיגה',
      'להתראות',
      'בבקשה',
    ],
    correctIndex: 1,
    funFact: '"Opa!" is shouted during celebrations, dancing, and plate-smashing. It expresses joy, excitement, and living in the moment!',
    funFactHe: '"אופה!" נצעק במהלך חגיגות, ריקודים ושבירת צלחות. זה מבטא שמחה, התרגשות וחיים ברגע!',
  },
  {
    id: 'q12b',
    dayIndex: 11,
    question: 'How do you say "thank you" in Greek?',
    questionHe: 'איך אומרים "תודה" ביוונית?',
    options: ['Yasou', 'Kalimera', 'Efharisto', 'Signomi'],
    optionsHe: ['יאסו', 'קלימרה', 'אפחריסטו', 'סיגנומי'],
    correctIndex: 2,
    funFact: '"Efharisto" (ευχαριστώ) means "thank you." The full phrase "Efharisto poli" means "thank you very much." Greeks truly appreciate it when visitors try the language!',
    funFactHe: '"אפחריסטו" (ευχαριστώ) פירושו "תודה". הביטוי המלא "אפחריסטו פולי" פירושו "תודה רבה". יוונים מעריכים מאוד כאשר מבקרים מנסים את השפה!',
  },
  {
    id: 'q12c',
    dayIndex: 11,
    question: 'What is the "Evil Eye" (Mati) in Greek culture?',
    questionHe: 'מה זה "עין הרע" (מאטי) בתרבות היוונית?',
    options: ['A traditional dance', 'An amulet to ward off bad luck', 'A type of Greek coffee', 'A spice used in cooking'],
    optionsHe: ['ריקוד מסורתי', 'קמע נגד מזל רע', 'סוג של קפה יווני', 'תבלין לבישול'],
    correctIndex: 1,
    funFact: 'The blue glass "evil eye" (mati) amulet is one of Greece\'s most recognized symbols. It\'s believed to protect the wearer from envious glares. You\'ll see it everywhere!',
    funFactHe: 'קמע "עין הרע" (מאטי) מזכוכית כחולה הוא אחד הסמלים המוכרים ביותר של יוון. מאמינים שהוא מגן על הלובש מפני מבטי קנאה. תראו אותו בכל מקום!',
  },
  {
    id: 'q12d',
    dayIndex: 11,
    question: 'Which Greek philosopher said "I know that I know nothing"?',
    questionHe: 'איזה פילוסוף יווני אמר "אני יודע שאני לא יודע כלום"?',
    options: ['Plato', 'Aristotle', 'Socrates', 'Pythagoras'],
    optionsHe: ['אפלטון', 'אריסטו', 'סוקרטס', 'פיתגורס'],
    correctIndex: 2,
    funFact: 'Socrates (470-399 BC) believed wisdom begins with acknowledging ignorance. He was sentenced to death by drinking hemlock for "corrupting the youth" of Athens!',
    funFactHe: 'סוקרטס (470-399 לפנה"ס) האמין שחוכמה מתחילה בהכרת הבורות. הוא נידון למוות על ידי שתיית רעל הצנן בגין "השחתת נוער" אתונה!',
  },
  {
    id: 'q12e',
    dayIndex: 11,
    question: 'Which Greek word gives us the word "democracy"?',
    questionHe: 'איזה מילה יוונית נותנת לנו את המילה "דמוקרטיה"?',
    options: ['"demos" (people) + "kratos" (rule)', '"theos" (god) + "polis" (city)', '"aster" (star) + "logos" (word)', '"geo" (earth) + "metron" (measure)'],
    optionsHe: ['"דמוס" (עם) + "קרטוס" (שלטון)', '"תאוס" (אל) + "פוליס" (עיר)', '"אסטר" (כוכב) + "לוגוס" (מילה)', '"גאו" (אדמה) + "מטרון" (מדידה)'],
    correctIndex: 0,
    funFact: 'Democracy (demokratia) = demos (people) + kratos (power/rule). Athens developed the world\'s first democracy around 507 BC under Cleisthenes — though only free male citizens could vote!',
    funFactHe: 'דמוקרטיה = דמוס (עם) + קרטוס (כוח/שלטון). אתונה פיתחה את הדמוקרטיה הראשונה בעולם בסביבות 507 לפנה"ס תחת קלייסתנס — אם כי רק אזרחים זכרים חופשיים יכלו להצביע!',
  },
];

// ─── Date-lock logic ──────────────────────────────────────────────────────────

function isDayUnlocked(dayIndex: number): boolean {
  // Pre-trip questions always unlocked
  if (dayIndex < 0) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const unlockDate = new Date(TRIP_START);
  unlockDate.setDate(unlockDate.getDate() + dayIndex);
  unlockDate.setHours(0, 0, 0, 0);
  return today >= unlockDate;
}

function getUnlockDate(dayIndex: number): string {
  const d = new Date(TRIP_START);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Component ────────────────────────────────────────────────────────────────

const QuizPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { quizAnswers, tripCode, currentMember, config, todayDayIndex } = useTripContext();
  const isRTL = i18n.language === 'he';

  // Tab types: 'pretrip' | 0-11
  const [selectedDay, setSelectedDay] = useState<number>(
    todayDayIndex >= 0 ? todayDayIndex : -10
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [answeredNow, setAnsweredNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lockedMsg, setLockedMsg] = useState<string | null>(null);

  // Questions for selected day (pre-trip or trip day)
  const dayQuestions = useMemo(
    () => QUIZ_QUESTIONS.filter((q) => q.dayIndex === selectedDay),
    [selectedDay]
  );

  // Active question (first answered one or first unanswered)
  const activeQuestion = useMemo(() => {
    if (selectedQuestionId) return QUIZ_QUESTIONS.find((q) => q.id === selectedQuestionId) ?? dayQuestions[0];
    // Pick first unanswered, else first
    const unanswered = dayQuestions.find(
      (q) => !quizAnswers.find((a) => a.memberId === currentMember?.id && a.questionId === q.id)
    );
    return unanswered ?? dayQuestions[0];
  }, [dayQuestions, selectedQuestionId, quizAnswers, currentMember]);

  const existingAnswer = useMemo(() => {
    if (!currentMember || !activeQuestion) return null;
    return quizAnswers.find((a) => a.memberId === currentMember.id && a.questionId === activeQuestion.id) || null;
  }, [quizAnswers, currentMember, activeQuestion]);

  const showResult = !!existingAnswer || answeredNow;
  const answerIndex = existingAnswer ? existingAnswer.selectedIndex : selectedOptionIndex;
  const isCorrect = activeQuestion ? answerIndex === activeQuestion.correctIndex : false;

  const handleSelectOption = async (optionIndex: number) => {
    if (showResult || !activeQuestion || !tripCode || !currentMember || saving) return;
    setSelectedOptionIndex(optionIndex);
    setSaving(true);
    try {
      const answer: QuizAnswer = {
        memberId: currentMember.id,
        questionId: activeQuestion.id,
        selectedIndex: optionIndex,
        correct: optionIndex === activeQuestion.correctIndex,
      };
      await saveQuizAnswer(tripCode, answer);
      setAnsweredNow(true);
    } catch (err) {
      console.error('Failed to save quiz answer:', err);
      setSelectedOptionIndex(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDayChange = (day: number) => {
    if (!isDayUnlocked(day)) {
      const msg = day >= 0
        ? (isRTL ? `זמין ב-${getUnlockDate(day)}` : `Available on ${getUnlockDate(day)}`)
        : '';
      setLockedMsg(msg);
      setTimeout(() => setLockedMsg(null), 2500);
      return;
    }
    setSelectedDay(day);
    setSelectedQuestionId(null);
    setSelectedOptionIndex(null);
    setAnsweredNow(false);
    setLockedMsg(null);
  };

  const handleQuestionSelect = (qId: string) => {
    setSelectedQuestionId(qId);
    setSelectedOptionIndex(null);
    setAnsweredNow(false);
  };

  // Scoreboard
  const scoreboard = useMemo(() => {
    if (!config) return [];
    return config.familyMembers.map((member) => {
      const memberAnswers = quizAnswers.filter((a) => a.memberId === member.id);
      const correctCount = memberAnswers.filter((a) => a.correct).length;
      return { member, correct: correctCount, total: memberAnswers.length };
    }).sort((a, b) => b.correct - a.correct);
  }, [config, quizAnswers]);

  // Pre-trip tabs (-10 to -1) and trip day tabs (0-11)
  const preTripTabs = Array.from({ length: 10 }, (_, i) => -(10 - i));
  const tripTabs = Array.from({ length: TOTAL_DAYS }, (_, i) => i);

  return (
    <div className="quiz-page">
      <h1>
        <HelpCircle size={24} />
        <span>{t('quiz.title')}</span>
      </h1>

      {/* Locked toast */}
      {lockedMsg && (
        <div className="quiz-locked-msg">{lockedMsg}</div>
      )}

      {/* Pre-trip question tabs */}
      <p className="quiz-section-label">{isRTL ? 'לפני הטיול (תמיד פתוח)' : 'Pre-Trip (always open)'}</p>
      <div className="day-tabs">
        {preTripTabs.map((d) => {
          return (
            <button
              key={d}
              className={`day-tab ${selectedDay === d ? 'active' : ''}`}
              onClick={() => handleDayChange(d)}
              title={isRTL ? `שאלה לפני-טיול ${Math.abs(d)}` : `Pre-trip Q${Math.abs(d)}`}
            >
              {isRTL ? `ט${Math.abs(d)}` : `P${Math.abs(d)}`}
            </button>
          );
        })}
      </div>

      {/* Trip day tabs */}
      <p className="quiz-section-label" style={{ marginTop: 8 }}>{isRTL ? 'ימי הטיול' : 'Trip Days'}</p>
      <div className="day-tabs">
        {tripTabs.map((i) => {
          const locked = !isDayUnlocked(i);
          return (
            <button
              key={i}
              className={`day-tab ${selectedDay === i ? 'active' : ''} ${todayDayIndex === i ? 'today' : ''} ${locked ? 'quiz-day-locked' : ''}`}
              onClick={() => handleDayChange(i)}
              title={locked ? (isRTL ? `זמין ב-${getUnlockDate(i)}` : `Available ${getUnlockDate(i)}`) : undefined}
            >
              {locked ? '🔒' : i + 1}
            </button>
          );
        })}
      </div>

      {/* Question selector for the day */}
      {dayQuestions.length > 1 && isDayUnlocked(selectedDay) && (
        <div className="quiz-question-tabs">
          {dayQuestions.map((q, idx) => {
            const answered = !!quizAnswers.find((a) => a.memberId === currentMember?.id && a.questionId === q.id);
            const isActive = activeQuestion?.id === q.id;
            return (
              <button
                key={q.id}
                className={`quiz-q-tab ${isActive ? 'active' : ''} ${answered ? 'answered' : ''}`}
                onClick={() => handleQuestionSelect(q.id)}
              >
                {answered ? '✓' : idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Quiz content */}
      {!activeQuestion || !isDayUnlocked(selectedDay) ? (
        <div className="empty-state">
          <Lock size={48} strokeWidth={1} />
          <p>{isRTL ? 'יום זה טרם נפתח' : 'This day is not yet unlocked'}</p>
          {selectedDay >= 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {isRTL ? `זמין ב-${getUnlockDate(selectedDay)}` : `Available on ${getUnlockDate(selectedDay)}`}
            </p>
          )}
        </div>
      ) : (
        <div className="quiz-card">
          <div className="quiz-question">
            <Star size={20} className="quiz-star" />
            <h2>
              {selectedDay < 0
                ? (isRTL ? `שאלת טרום-טיול ${Math.abs(selectedDay)}` : `Pre-trip Question ${Math.abs(selectedDay)}`)
                : t('quiz.question', { day: selectedDay + 1 })
              }
            </h2>
            <p>{isRTL ? activeQuestion.questionHe : activeQuestion.question}</p>
          </div>

          <div className="quiz-options">
            {(isRTL ? activeQuestion.optionsHe : activeQuestion.options).map((option, idx) => {
              let className = 'quiz-option';
              if (showResult) {
                if (idx === activeQuestion.correctIndex) className += ' quiz-option-correct';
                else if (idx === answerIndex && idx !== activeQuestion.correctIndex) className += ' quiz-option-wrong';
              }
              if (!showResult && selectedOptionIndex === idx) className += ' selected';
              return (
                <button
                  key={idx}
                  className={className}
                  onClick={() => handleSelectOption(idx)}
                  disabled={showResult || saving}
                >
                  <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                  <span className="option-text">{option}</span>
                  {showResult && idx === activeQuestion.correctIndex && <CheckCircle size={20} className="option-icon" />}
                  {showResult && idx === answerIndex && idx !== activeQuestion.correctIndex && <XCircle size={20} className="option-icon" />}
                </button>
              );
            })}
          </div>

          {showResult && (
            <div className="quiz-result">
              <div className={`result-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                {isCorrect ? <><CheckCircle size={24} /><span>{t('quiz.correct')}</span></> : <><XCircle size={24} /><span>{t('quiz.incorrect')}</span></>}
              </div>
              <div className="fun-fact">
                <Star size={16} />
                <div>
                  <strong>{t('quiz.funFact')}</strong>
                  <p>{isRTL ? activeQuestion.funFactHe : activeQuestion.funFact}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scoreboard */}
      <div className="scoreboard">
        <h2>
          <Trophy size={22} />
          <span>{t('quiz.scoreboard')}</span>
        </h2>
        <div className="scoreboard-table">
          {scoreboard.map(({ member, correct, total }, idx) => (
            <div key={member.id} className="score-row">
              <div className="score-rank">
                {idx === 0 && correct > 0 ? <Trophy size={18} className="trophy-icon" /> : <span>{idx + 1}</span>}
              </div>
              <div className="score-member">
                <span className="member-emoji">{member.emoji}</span>
                <span className="member-name">{isRTL ? member.nameHe : member.name}</span>
              </div>
              <div className="score-value">{t('quiz.score', { correct, total })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuizPage;
