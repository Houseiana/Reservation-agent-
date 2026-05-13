export type Country = "egypt";

export const SITE_URL = "https://houseiana.com.eg";

export interface Owner {
  name: string;
  phone: string;
  whatsapp: string;
  responseTime: string;
}

export type Amenities = Record<string, boolean | undefined>;

export interface Extra {
  id: string;
  name: string;
  desc: string;
  price: number;
  currency: string;
  unit: string;
}

export interface Room {
  name: string;
  info: string;
}

export interface Property {
  id: string;
  name: string;
  nameAr: string;
  loc: string;
  locAr: string;
  descAr: string;
  country: Country;
  type: string;
  tier: "luxury" | "standard";
  price: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  capacity: number;
  area: number;
  rating: number;
  reviews: number;
  instantBook: boolean;
  superhost: boolean;
  verified: boolean;
  freeCancel: boolean;
  desc: string;
  rooms: Room[];
  amenities: Amenities;
  extras: Extra[];
  fees: { cleaning: number; utilities: number; bookingFeePct: number; deposit: number };
  policies: { checkin: string; checkout: string; minNights: number; cancel: string };
  owner: Owner;
}

export interface Guest {
  id: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  nat: string;
  bookings: number;
  ltv: string;
  isNew?: boolean;
}

export type BookingChannel = "wa" | "call" | "web" | "direct";
export type PaymentStatus = "paid" | "partial" | "pending";

export interface Booking {
  ref: string;
  guest: Guest;
  property: Property;
  checkin: string;
  checkout: string;
  nights: number;
  total: string;
  totalAmount: number;
  paidAmount: number;
  status: "confirmed" | "pending" | "checkedin" | "checkedout" | "cancelled";
  channel: BookingChannel;
  paymentStatus: PaymentStatus;
  notes?: string;
}

export const PROPERTIES: Property[] = [
  {
    id: "P001",
    name: "Nile Plaza Tower — 2BR Nile View",
    nameAr: "برج النيل بلازا — غرفتين بإطلالة نيل",
    loc: "Garden City, Cairo",
    locAr: "جاردن سيتي، القاهرة",
    descAr: "شقة مذهلة بإطلالة على النيل في قلب جاردن سيتي. نوافذ من الأرض للسقف تطل على الكورنيش. على بُعد خطوات من المتحف المصري وميدان التحرير ومقاهي وسط البلد.",
    country: "egypt",
    type: "apartment", tier: "luxury", price: 3500, currency: "EGP",
    bedrooms: 2, bathrooms: 2, beds: 3, capacity: 4, area: 135,
    rating: 4.9, reviews: 142, instantBook: true, superhost: true, verified: true, freeCancel: true,
    desc: "Stunning Nile-view apartment in Garden City. Floor-to-ceiling windows overlook the Corniche. Walking distance to the Egyptian Museum, Tahrir Square and downtown cafés.",
    rooms: [
      { name: "Bedroom 1", info: "1 king bed · ensuite" },
      { name: "Bedroom 2", info: "2 single beds" },
      { name: "Living", info: "Sofa bed for 1" },
      { name: "Kitchen", info: "Fully equipped" },
    ],
    amenities: {
      ac: true, heating: true, wifi: true, kitchen: true, washer: true, dryer: true, tv: true,
      parking: true, pool: true, gym: true, elevator: true, balcony: true, seaview: true,
      workspace: true, hairdryer: true, iron: true, safe: true,
      smoking: false, pets: false, events: false,
    },
    extras: [
      { id: "beach", name: "Gezira Club day access", desc: "Private club, daily", price: 250, currency: "EGP", unit: "per person/day" },
      { id: "parking2", name: "Second parking spot", desc: "Reserved underground space", price: 100, currency: "EGP", unit: "per night" },
      { id: "pickup", name: "Cairo airport pickup (sedan)", desc: "Meet & greet, up to 4 pax", price: 500, currency: "EGP", unit: "one-way" },
      { id: "breakfast", name: "Breakfast hamper", desc: "Continental, delivered daily", price: 250, currency: "EGP", unit: "per day" },
      { id: "cleaning", name: "Daily housekeeping", desc: "Linen change & cleaning", price: 350, currency: "EGP", unit: "per day" },
    ],
    fees: { cleaning: 500, utilities: 350, bookingFeePct: 10, deposit: 2000 },
    policies: { checkin: "15:00", checkout: "12:00", minNights: 2, cancel: "Moderate — full refund 5 days before" },
    owner: { name: "Mohamed Sharif", phone: "+20 102 778 1290", whatsapp: "+20 102 778 1290", responseTime: "Usually replies within 30 min" },
  },
  {
    id: "P002",
    name: "Cairo Festival City Penthouse",
    nameAr: "بنتهاوس كايرو فستيفال سيتي",
    loc: "New Cairo, Egypt",
    locAr: "القاهرة الجديدة",
    descAr: "بنتهاوس حصري بسطح خاص وإطلالة بانورامية على الأفق ووصول مباشر لمول كايرو فستيفال سيتي. مثالي للعائلات الكبيرة ومجموعات العمل.",
    country: "egypt",
    type: "penthouse", tier: "luxury", price: 7500, currency: "EGP",
    bedrooms: 4, bathrooms: 4, beds: 6, capacity: 8, area: 320,
    rating: 4.95, reviews: 87, instantBook: false, superhost: true, verified: true, freeCancel: true,
    desc: "Exclusive penthouse with private rooftop, panoramic skyline views and direct access to Cairo Festival City Mall. Ideal for families and executive groups.",
    rooms: [
      { name: "Master suite", info: "King bed · ensuite · skyline view" },
      { name: "Bedroom 2", info: "Queen bed · ensuite" },
      { name: "Bedroom 3", info: "2 single beds" },
      { name: "Bedroom 4", info: "Queen bed" },
    ],
    amenities: {
      ac: true, heating: true, wifi: true, kitchen: true, washer: true, dryer: true, tv: true,
      parking: true, pool: true, gym: true, elevator: true, balcony: true,
      workspace: true, hairdryer: true, iron: true, safe: true, jacuzzi: true, bbq: true,
      smoking: false, pets: false, events: true,
    },
    extras: [
      { id: "chef", name: "Private chef service", desc: "Per meal, max 8 guests", price: 2500, currency: "EGP", unit: "per meal" },
      { id: "yacht", name: "Felucca cruise (private)", desc: "Up to 8 pax, with crew", price: 4000, currency: "EGP", unit: "half-day" },
      { id: "pickup", name: "Airport pickup (luxury SUV)", desc: "Meet & greet, up to 6 pax", price: 1200, currency: "EGP", unit: "one-way" },
    ],
    fees: { cleaning: 1200, utilities: 600, bookingFeePct: 10, deposit: 6000 },
    policies: { checkin: "16:00", checkout: "11:00", minNights: 3, cancel: "Strict — 50% refund up to 7 days before" },
    owner: { name: "Yasmine El-Dabbagh", phone: "+20 100 449 6612", whatsapp: "+20 100 449 6612", responseTime: "Usually replies within 2h · prefers WhatsApp" },
  },
  {
    id: "P003",
    name: "Maadi Riverside Studio",
    nameAr: "استوديو ضفاف النيل بالمعادي",
    loc: "Maadi, Cairo",
    locAr: "المعادي، القاهرة",
    descAr: "استوديو حديث في المعادي الهادئة على بُعد دقائق من النيل والكورنيش. مثالي للأزواج أو المسافرين بمفردهم لأغراض العمل.",
    country: "egypt",
    type: "studio", tier: "standard", price: 1100, currency: "EGP",
    bedrooms: 1, bathrooms: 1, beds: 1, capacity: 2, area: 55,
    rating: 4.7, reviews: 64, instantBook: true, superhost: false, verified: true, freeCancel: true,
    desc: "Modern studio in leafy Maadi with Nile-side strolls minutes away. Perfect for couples or solo business travellers.",
    rooms: [{ name: "Studio", info: "Queen bed + sofa" }, { name: "Bath", info: "Walk-in shower" }],
    amenities: {
      ac: true, wifi: true, kitchen: true, washer: true, tv: true,
      parking: true, pool: true, gym: true, elevator: true, balcony: true,
      workspace: true, hairdryer: true, iron: true,
      heating: false, dryer: false, seaview: false, smoking: false, pets: false, events: false,
    },
    extras: [
      { id: "parking", name: "Reserved parking", desc: "Underground space", price: 80, currency: "EGP", unit: "per night" },
      { id: "cleaning", name: "Mid-stay cleaning", desc: "Optional linen change", price: 200, currency: "EGP", unit: "per visit" },
    ],
    fees: { cleaning: 350, utilities: 150, bookingFeePct: 10, deposit: 1500 },
    policies: { checkin: "15:00", checkout: "12:00", minNights: 1, cancel: "Flexible — full refund 24h before" },
    owner: { name: "Karim Adel", phone: "+20 109 332 5470", whatsapp: "+20 109 332 5470", responseTime: "Usually replies within 15 min" },
  },
  {
    id: "P004",
    name: "Heliopolis Heritage Loft",
    nameAr: "لوفت تراثي بمصر الجديدة",
    loc: "Heliopolis, Cairo",
    locAr: "مصر الجديدة، القاهرة",
    descAr: "لوفت يجمع بين التراث والحداثة في قلب مصر الجديدة. على بُعد خطوات من قصر البارون وكوربا وخط الترام الشهير.",
    country: "egypt",
    type: "apartment", tier: "standard", price: 1800, currency: "EGP",
    bedrooms: 1, bathrooms: 1, beds: 2, capacity: 2, area: 85,
    rating: 4.8, reviews: 53, instantBook: true, superhost: true, verified: true, freeCancel: false,
    desc: "Heritage-meets-modern loft in historic Heliopolis. Walking distance to Baron Empain Palace, Korba and the famous tram line.",
    rooms: [{ name: "Bedroom", info: "King bed" }, { name: "Living", info: "Sofa bed" }, { name: "Kitchen", info: "Open plan" }],
    amenities: {
      ac: true, heating: true, wifi: true, kitchen: true, washer: true, dryer: true, tv: true,
      elevator: true, workspace: true, hairdryer: true, iron: true,
      parking: false, pool: false, gym: false, balcony: false, seaview: false,
      smoking: false, pets: true, events: false,
    },
    extras: [
      { id: "tour", name: "Old Cairo walking tour", desc: "Private guide, 3 hours", price: 800, currency: "EGP", unit: "per group" },
      { id: "breakfast", name: "Local breakfast delivery", desc: "Foul, ta'meya & shai daily", price: 150, currency: "EGP", unit: "per day" },
    ],
    fees: { cleaning: 400, utilities: 200, bookingFeePct: 10, deposit: 1500 },
    policies: { checkin: "15:00", checkout: "11:00", minNights: 2, cancel: "Moderate — full refund 5 days before" },
    owner: { name: "Nadia Hosni", phone: "+20 101 884 7723", whatsapp: "+20 101 884 7723", responseTime: "Usually replies within 1h" },
  },
  {
    id: "P005",
    name: "Zamalek Heights — Nile View",
    nameAr: "زمالك هايتس — بإطلالة على النيل",
    loc: "Zamalek, Cairo",
    locAr: "الزمالك، القاهرة",
    descAr: "شقة مرمّمة من ثلاثينيات القرن الماضي في الزمالك بإطلالة على النيل. أسقف عالية، تفاصيل أصلية، وشارع هادئ.",
    country: "egypt",
    type: "apartment", tier: "standard", price: 1800, currency: "EGP",
    bedrooms: 2, bathrooms: 2, beds: 3, capacity: 4, area: 110,
    rating: 4.85, reviews: 98, instantBook: true, superhost: true, verified: true, freeCancel: true,
    desc: "Renovated 1930s apartment in Zamalek with Nile views. High ceilings, original features and a quiet street.",
    rooms: [{ name: "Master", info: "King bed · ensuite" }, { name: "Bedroom 2", info: "2 single beds" }, { name: "Living", info: "Salon classic" }],
    amenities: {
      ac: true, wifi: true, kitchen: true, washer: true, tv: true,
      elevator: true, balcony: true, workspace: true, hairdryer: true, iron: true,
      parking: false, pool: false, gym: false, dryer: false, heating: false,
      smoking: false, pets: false, events: false,
    },
    extras: [
      { id: "driver", name: "Private driver (full day)", desc: "8h with sedan", price: 1500, currency: "EGP", unit: "per day" },
      { id: "cook", name: "Egyptian cook", desc: "Lunch or dinner, 4 pax", price: 600, currency: "EGP", unit: "per meal" },
      { id: "pickup", name: "Cairo airport pickup", desc: "Meet & greet, up to 4 pax", price: 400, currency: "EGP", unit: "one-way" },
    ],
    fees: { cleaning: 200, utilities: 250, bookingFeePct: 10, deposit: 1000 },
    policies: { checkin: "14:00", checkout: "12:00", minNights: 2, cancel: "Flexible — full refund 24h before" },
    owner: { name: "Tarek Saleh", phone: "+20 122 663 1108", whatsapp: "+20 122 663 1108", responseTime: "Usually replies within 10 min" },
  },
  {
    id: "P006",
    name: "Sahel Sapphire Villa",
    nameAr: "فيلا سفير الساحل",
    loc: "North Coast, Egypt",
    locAr: "الساحل الشمالي",
    descAr: "فيلا على البحر مباشرةً بحمام سباحة خاص وحديقة ووصول مباشر للشاطئ. مثالية للعائلات الكبيرة والمجموعات في الصيف.",
    country: "egypt",
    type: "villa", tier: "luxury", price: 3500, currency: "EGP",
    bedrooms: 5, bathrooms: 5, beds: 8, capacity: 10, area: 420,
    rating: 4.9, reviews: 41, instantBook: false, superhost: true, verified: true, freeCancel: false,
    desc: "Beachfront villa with private pool, garden and direct sea access. Ideal for large families and groups during summer season.",
    rooms: [
      { name: "Master suite", info: "King · ensuite · sea view" },
      { name: "Bedroom 2", info: "King · ensuite" },
      { name: "Bedroom 3", info: "2 single" },
      { name: "Bedroom 4", info: "Queen" },
      { name: "Bedroom 5", info: "Bunk room (4)" },
    ],
    amenities: {
      ac: true, wifi: true, kitchen: true, washer: true, dryer: true, tv: true,
      parking: true, pool: true, balcony: true, seaview: true, beachAccess: true,
      workspace: true, hairdryer: true, iron: true, bbq: true, garden: true,
      heating: false, gym: false, elevator: false,
      smoking: true, pets: true, events: true,
    },
    extras: [
      { id: "beach", name: "Beach club premium access", desc: "Private cabanas, daily", price: 800, currency: "EGP", unit: "per day" },
      { id: "cleaning", name: "Daily housekeeper", desc: "Cleaning & linen", price: 400, currency: "EGP", unit: "per day" },
      { id: "cook", name: "Live-in cook", desc: "Breakfast + dinner, full stay", price: 5000, currency: "EGP", unit: "per week" },
      { id: "jetski", name: "Jet ski rental", desc: "1 hour", price: 1200, currency: "EGP", unit: "per hour" },
    ],
    fees: { cleaning: 600, utilities: 500, bookingFeePct: 10, deposit: 5000 },
    policies: { checkin: "16:00", checkout: "11:00", minNights: 3, cancel: "Strict — 50% refund up to 14 days before" },
    owner: { name: "Hala Mansour", phone: "+20 100 887 4422", whatsapp: "+20 100 887 4422", responseTime: "Slow during off-season · prefers calls" },
  },
  {
    id: "P007",
    name: "New Cairo Garden Suite",
    nameAr: "جناح حديقة القاهرة الجديدة",
    loc: "New Cairo, Egypt",
    locAr: "القاهرة الجديدة",
    descAr: "جناح هادئ في الدور الأرضي بحديقة داخل كومباوند مغلق. قريب من الجامعة الأمريكية والمناطق التجارية الرئيسية.",
    country: "egypt",
    type: "apartment", tier: "standard", price: 1100, currency: "EGP",
    bedrooms: 1, bathrooms: 1, beds: 1, capacity: 2, area: 75,
    rating: 4.6, reviews: 39, instantBook: true, superhost: false, verified: true, freeCancel: true,
    desc: "Quiet ground-floor garden suite in a gated compound. Close to AUC and major business districts.",
    rooms: [{ name: "Bedroom", info: "Queen bed" }, { name: "Living", info: "Open plan" }],
    amenities: {
      ac: true, wifi: true, kitchen: true, washer: true, tv: true,
      parking: true, pool: true, gym: true, garden: true, workspace: true,
      hairdryer: true, iron: true,
      heating: false, balcony: false, seaview: false, dryer: false, elevator: false,
      smoking: false, pets: false, events: false,
    },
    extras: [
      { id: "pickup", name: "Airport pickup", desc: "Sedan, up to 3 pax", price: 350, currency: "EGP", unit: "one-way" },
      { id: "gym", name: "Compound gym pass (extra)", desc: "For 2nd guest", price: 150, currency: "EGP", unit: "per stay" },
    ],
    fees: { cleaning: 150, utilities: 150, bookingFeePct: 10, deposit: 600 },
    policies: { checkin: "15:00", checkout: "11:00", minNights: 1, cancel: "Flexible — full refund 24h before" },
    owner: { name: "Ahmed Magdy", phone: "+20 106 552 1190", whatsapp: "+20 106 552 1190", responseTime: "Usually replies within 1h" },
  },
  {
    id: "P008",
    name: "Alexandria Corniche Apartment",
    nameAr: "شقة كورنيش الإسكندرية",
    loc: "Alexandria, Egypt",
    locAr: "الإسكندرية",
    descAr: "إطلالة مباشرة على البحر المتوسط من البلكونة. على بُعد خطوات من كوبري ستانلي وكورنيش الإسكندرية التاريخي.",
    country: "egypt",
    type: "apartment", tier: "standard", price: 950, currency: "EGP",
    bedrooms: 2, bathrooms: 1, beds: 3, capacity: 3, area: 90,
    rating: 4.5, reviews: 27, instantBook: true, superhost: false, verified: true, freeCancel: true,
    desc: "Direct Mediterranean views from balcony. Walking distance to Stanley Bridge and the historic Corniche.",
    rooms: [{ name: "Bedroom 1", info: "Queen" }, { name: "Bedroom 2", info: "2 single" }],
    amenities: {
      ac: true, wifi: true, kitchen: true, washer: true, tv: true,
      balcony: true, seaview: true, elevator: true, hairdryer: true, iron: true,
      heating: false, parking: false, pool: false, gym: false, dryer: false,
      smoking: false, pets: false, events: false,
    },
    extras: [
      { id: "tour", name: "Alexandria heritage tour", desc: "Private guide, 4h", price: 600, currency: "EGP", unit: "per group" },
    ],
    fees: { cleaning: 120, utilities: 200, bookingFeePct: 10, deposit: 500 },
    policies: { checkin: "14:00", checkout: "12:00", minNights: 2, cancel: "Flexible — full refund 24h before" },
    owner: { name: "Mostafa Helmy", phone: "+20 122 994 0233", whatsapp: "+20 122 994 0233", responseTime: "Usually replies within 45 min" },
  },
];

export interface AmenityDef {
  id: string;
  label: string;
  icon: string;
}

export const ESSENTIAL_AMENITIES: AmenityDef[] = [
  { id: "ac", label: "Air conditioning", icon: "M5 11h14M5 15h14M9 7l-2 4M15 7l-2 4M11 19l-2-4M17 19l-2-4" },
  { id: "wifi", label: "Wi-Fi", icon: "M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" },
  { id: "kitchen", label: "Kitchen", icon: "M3 21V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v14M3 11h18M8 7v.01M16 7v.01" },
  { id: "washer", label: "Washer", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 19a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" },
  { id: "tv", label: "TV", icon: "M2 6h20v12H2zM7 22h10" },
  { id: "parking", label: "Free parking", icon: "M9 17V7h4a3 3 0 0 1 0 6H9" },
  { id: "elevator", label: "Elevator", icon: "M9 4l-4 4 4 4M9 16l-4 4 4 4M15 4l4 4-4 4M15 16l4 4-4 4" },
  { id: "workspace", label: "Workspace", icon: "M3 12h18M3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6M5 12V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M9 6V4M15 6V4" },
];

export const FEATURE_AMENITIES: AmenityDef[] = [
  { id: "pool", label: "Pool", icon: "M2 20s2-2 5-2 5 2 8 2 5-2 5-2M2 14s2-2 5-2 5 2 8 2 5-2 5-2M9 12V4M15 12V6" },
  { id: "gym", label: "Gym", icon: "M6 6l-2 2 4 4-4 4 2 2 4-4 4 4 2-2-4-4 4-4-2-2-4 4z" },
  { id: "balcony", label: "Balcony", icon: "M3 21h18M5 21V11h4v10M15 21V11h4v10M3 11h18M9 7h6v4H9z" },
  { id: "seaview", label: "Sea view", icon: "M2 12s2 2 5 2 5-2 5-2 2 2 5 2 5-2 5-2M2 17s2 2 5 2 5-2 5-2 2 2 5 2 5-2 5-2M2 7s2 2 5 2 5-2 5-2 2 2 5 2 5-2 5-2" },
  { id: "beachAccess", label: "Beach access", icon: "M2 22h20M3 18l9-12 9 12M9 14l3-4 3 4" },
  { id: "garden", label: "Private garden", icon: "M12 22V8M5 12s2-3 7-3 7 3 7 3M3 8s4-4 9-4 9 4 9 4" },
  { id: "jacuzzi", label: "Jacuzzi", icon: "M2 12h20v5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-5zM8 12V7a3 3 0 0 1 6 0M14 7l2-2" },
  { id: "bbq", label: "BBQ", icon: "M5 8h14l-2 13H7zM7 8c0-3 2-5 5-5s5 2 5 5" },
  { id: "pets", label: "Pets allowed", icon: "M11 14c0-3-3-5-5-5s-3 2-3 4 1 4 4 4M21 11c0-2-1-4-3-4s-5 2-5 5M11 14h2v6" },
  { id: "events", label: "Events allowed", icon: "M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-7.6-3.8L3 21l1.9-1.9C4 17.6 3 15.6 3 13.5a8.5 8.5 0 0 1 17 0z" },
];

export const EXTRA_FILTERS: { id: string; label: string }[] = [
  { id: "beach", label: "Beach access fee" },
  { id: "pickup", label: "Airport pickup" },
  { id: "cleaning", label: "Daily housekeeping" },
  { id: "breakfast", label: "Breakfast delivery" },
  { id: "chef", label: "Private chef" },
  { id: "driver", label: "Private driver" },
  { id: "tour", label: "Tours & activities" },
];

export const GUESTS: Guest[] = [
  { id: "G-1042", first: "Ahmed", last: "Khalifa", email: "ahmed.k@email.com", phone: "+20 102 555 0142", nat: "Egyptian", bookings: 7, ltv: "EGP 124,500" },
  { id: "G-2018", first: "Fatima", last: "Hassan", email: "fatima.h@email.com", phone: "+20 100 234 5678", nat: "Egyptian", bookings: 4, ltv: "EGP 88,200" },
  { id: "G-0892", first: "Hossam", last: "El-Sayed", email: "hossam.s@email.com", phone: "+20 100 887 4422", nat: "Egyptian", bookings: 3, ltv: "EGP 49,800" },
  { id: "G-1577", first: "Layla", last: "Mostafa", email: "layla.mostafa@email.com", phone: "+20 109 778 2245", nat: "Egyptian", bookings: 11, ltv: "EGP 252,300" },
  { id: "G-2204", first: "Omar", last: "Mahmoud", email: "omar.m@email.com", phone: "+20 122 555 8899", nat: "Egyptian", bookings: 2, ltv: "EGP 17,400" },
  { id: "G-0331", first: "Sara", last: "Ibrahim", email: "sara.ibrahim@email.com", phone: "+20 106 882 4419", nat: "Egyptian", bookings: 1, ltv: "EGP 4,200" },
];

// Anchored to a fixed "today" of 2026-05-13 so urgency states are predictable in the demo.
export const TODAY_STR = "2026-05-13";

export const BOOKINGS: Booking[] = [
  // Ahmed (VIP) checking in TODAY · Nile Plaza · WA · paid
  { ref: "HSI-A8K2P9", guest: GUESTS[0], property: PROPERTIES[0], checkin: "2026-05-13", checkout: "2026-05-17", nights: 4, total: "EGP 16,250", totalAmount: 16250, paidAmount: 16250, status: "confirmed", channel: "wa", paymentStatus: "paid", notes: "Late check-in around 22:00, arriving from CAI." },
  // Fatima (Repeat) checking OUT today · Zamalek · WA · paid · in-house
  { ref: "HSI-B3M7L1", guest: GUESTS[1], property: PROPERTIES[4], checkin: "2026-05-09", checkout: "2026-05-13", nights: 4, total: "EGP 8,370", totalAmount: 8370, paidAmount: 8370, status: "checkedin", channel: "wa", paymentStatus: "paid" },
  // Hossam (Repeat) IN-HOUSE · Cairo Festival Penthouse · call · paid
  { ref: "HSI-C5N4Q8", guest: GUESTS[2], property: PROPERTIES[1], checkin: "2026-05-10", checkout: "2026-05-16", nights: 6, total: "EGP 51,300", totalAmount: 51300, paidAmount: 51300, status: "checkedin", channel: "call", paymentStatus: "paid", notes: "Will ask about extending stay." },
  // Layla (VIP) checking in TOMORROW · Heliopolis · WA · PENDING PAYMENT
  { ref: "HSI-D7R2X4", guest: GUESTS[3], property: PROPERTIES[3], checkin: "2026-05-14", checkout: "2026-05-17", nights: 3, total: "EGP 6,540", totalAmount: 6540, paidAmount: 0, status: "pending", channel: "wa", paymentStatus: "pending", notes: "Awaiting InstaPay transfer." },
  // Omar (Repeat) past · New Cairo · web · paid
  { ref: "HSI-E1T9V6", guest: GUESTS[4], property: PROPERTIES[6], checkin: "2026-05-06", checkout: "2026-05-09", nights: 3, total: "EGP 3,930", totalAmount: 3930, paidAmount: 3930, status: "checkedout", channel: "web", paymentStatus: "paid" },
  // Sara (New) in 7 days · Maadi Studio · call · PARTIAL 50%
  { ref: "HSI-F4W3Y7", guest: GUESTS[5], property: PROPERTIES[2], checkin: "2026-05-20", checkout: "2026-05-23", nights: 3, total: "EGP 4,130", totalAmount: 4130, paidAmount: 2065, status: "confirmed", channel: "call", paymentStatus: "partial", notes: "Balance due 3 days before check-in." },
  // Layla (VIP) far future · Sahel Villa · WA · PARTIAL 50%
  { ref: "HSI-G2K5N8", guest: GUESTS[3], property: PROPERTIES[5], checkin: "2026-06-15", checkout: "2026-06-22", nights: 7, total: "EGP 28,050", totalAmount: 28050, paidAmount: 14025, status: "confirmed", channel: "wa", paymentStatus: "partial", notes: "Family of 8 + chef requested." },
  // Ahmed (VIP) checking in TOMORROW (1 night) · Maadi Studio · call · paid
  { ref: "HSI-H4M9P2", guest: GUESTS[0], property: PROPERTIES[2], checkin: "2026-05-14", checkout: "2026-05-15", nights: 1, total: "EGP 1,710", totalAmount: 1710, paidAmount: 1710, status: "confirmed", channel: "call", paymentStatus: "paid", notes: "1-night business stay." },
  // Fatima (Repeat) in 2 days · Sahel Villa · WA · PARTIAL
  { ref: "HSI-J7Q1R5", guest: GUESTS[1], property: PROPERTIES[5], checkin: "2026-05-15", checkout: "2026-05-18", nights: 3, total: "EGP 12,650", totalAmount: 12650, paidAmount: 6325, status: "confirmed", channel: "wa", paymentStatus: "partial" },
  // Hossam (Repeat) cancelled · Alexandria · web · refunded
  { ref: "HSI-K3T8V6", guest: GUESTS[2], property: PROPERTIES[7], checkin: "2026-04-25", checkout: "2026-04-29", nights: 4, total: "EGP 4,500", totalAmount: 4500, paidAmount: 4500, status: "cancelled", channel: "web", paymentStatus: "paid" },
];

export interface Destination {
  name: string;
  nameAr: string;
  meta: string;
  metaAr: string;
}

export const DESTINATIONS: Destination[] = [
  { name: "Zamalek, Cairo", nameAr: "الزمالك، القاهرة", meta: "Egypt · 12 properties", metaAr: "مصر · 12 عقار" },
  { name: "Garden City, Cairo", nameAr: "جاردن سيتي، القاهرة", meta: "Egypt · 7 properties", metaAr: "مصر · 7 عقار" },
  { name: "Maadi, Cairo", nameAr: "المعادي، القاهرة", meta: "Egypt · 10 properties", metaAr: "مصر · 10 عقار" },
  { name: "New Cairo", nameAr: "القاهرة الجديدة", meta: "Egypt · 9 properties", metaAr: "مصر · 9 عقار" },
  { name: "Heliopolis, Cairo", nameAr: "مصر الجديدة، القاهرة", meta: "Egypt · 6 properties", metaAr: "مصر · 6 عقار" },
  { name: "Alexandria", nameAr: "الإسكندرية", meta: "Egypt · 5 properties", metaAr: "مصر · 5 عقار" },
  { name: "North Coast (Sahel)", nameAr: "الساحل الشمالي", meta: "Egypt · 7 properties", metaAr: "مصر · 7 عقار" },
  { name: "Hurghada", nameAr: "الغردقة", meta: "Egypt · 4 properties", metaAr: "مصر · 4 عقار" },
];

export interface InboxItem {
  id: number;
  type: "wa" | "call" | "missed";
  from: string;
  avatar: string;
  phone: string;
  preview: string;
  time: string;
  unread: boolean;
  status: "qualified" | "quoted" | "booked" | "lost" | "new";
  knownGuest: boolean;
  duration?: string;
}

export const INBOX: InboxItem[] = [
  { id: 1, type: "wa", from: "Fatima Hassan", avatar: "FH", phone: "+20 100 234 5678", preview: "Are the dates Aug 12-19 still available for Sahel Sapphire?", time: "2 min", unread: true, status: "qualified", knownGuest: true },
  { id: 2, type: "call", from: "Ahmed Khalifa", avatar: "AK", phone: "+20 102 555 0142", preview: "Voice call · 4m 32s · asked about Nile Plaza extras", time: "18 min", unread: true, status: "quoted", knownGuest: true, duration: "4:32" },
  { id: 3, type: "wa", from: "Unknown", avatar: "?", phone: "+20 101 887 4421", preview: "Hi, do you have a 3-bedroom apartment in Zamalek for next weekend?", time: "34 min", unread: true, status: "new", knownGuest: false },
  { id: 4, type: "missed", from: "Layla Mostafa", avatar: "LM", phone: "+20 109 778 2245", preview: "Missed call · returned at 14:22", time: "1h", unread: false, status: "booked", knownGuest: true },
  { id: 5, type: "wa", from: "Omar Mahmoud", avatar: "OM", phone: "+20 122 555 8899", preview: "Thanks! I'll confirm with my wife and get back to you.", time: "2h", unread: false, status: "quoted", knownGuest: true },
  { id: 6, type: "call", from: "Sara Ibrahim", avatar: "SI", phone: "+20 106 882 4419", preview: "Voice call · 7m 12s · booked Maadi Studio for Aug 5-9", time: "3h", unread: false, status: "booked", knownGuest: true, duration: "7:12" },
  { id: 7, type: "wa", from: "Unknown", avatar: "?", phone: "+20 109 442 1156", preview: "Salam, I saw your villa on Instagram, what's the price?", time: "5h", unread: false, status: "qualified", knownGuest: false },
  { id: 8, type: "missed", from: "Unknown", avatar: "?", phone: "+20 111 442 8830", preview: "Missed call · no callback yet", time: "6h", unread: false, status: "new", knownGuest: false },
  { id: 9, type: "wa", from: "Hossam El-Sayed", avatar: "HE", phone: "+20 100 887 4422", preview: "Cancellation confirmed, refund processed.", time: "yesterday", unread: false, status: "lost", knownGuest: true },
];

export interface IncomingCaller {
  avatar: string;
  name: string;
  phone: string;
  tag: string;
  context: string;
  channel: "call" | "wa";
}

export const INCOMING_CALLERS: IncomingCaller[] = [
  { avatar: "FH", name: "Fatima Hassan", phone: "+20 100 234 5678", tag: "Returning guest · 4 bookings", context: 'Last booking: <b style="color:var(--text)">Zamalek Heights</b> · checked out 3 days ago. Asked about North Coast availability via WhatsApp last week.', channel: "call" },
  { avatar: "?", name: "Unknown caller", phone: "+20 101 887 4421", tag: "New lead · first contact", context: 'Number not in CRM. Inbound from <b style="color:var(--text)">Houseiana hotline</b>. Source: Instagram ad campaign #IG-EG-Aug.', channel: "call" },
  { avatar: "AK", name: "Ahmed Khalifa", phone: "+20 102 555 0142", tag: "VIP · 7 bookings · EGP 124,500 LTV", context: 'Active booking: <b style="color:var(--text)">Nile Plaza Tower</b> · checks in tomorrow 15:00. Likely calling about early check-in.', channel: "wa" },
  { avatar: "LM", name: "Layla Mostafa", phone: "+20 109 778 2245", tag: "VIP · 11 bookings", context: 'Browsing <b style="color:var(--text)">Cairo Festival City Penthouse</b> · spent 18 min on listing this morning.', channel: "call" },
];

export const PD_AMENITY_LIST: { key: string; label: string; icon: string }[] = [
  { key: "ac", label: "Air conditioning", icon: "M5 11h14M5 15h14" },
  { key: "heating", label: "Heating", icon: "M12 2v8M5 9l7 7 7-7" },
  { key: "wifi", label: "High-speed Wi-Fi", icon: "M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" },
  { key: "kitchen", label: "Fully equipped kitchen", icon: "M3 21V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v14" },
  { key: "washer", label: "Washing machine", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 19a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" },
  { key: "dryer", label: "Dryer", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h8M16 12h.01M12 12h.01M8 12h.01M8 16h.01M12 16h.01M16 16h.01" },
  { key: "tv", label: "Smart TV", icon: "M2 6h20v12H2zM7 22h10" },
  { key: "parking", label: "Free parking", icon: "M9 17V7h4a3 3 0 0 1 0 6H9" },
  { key: "pool", label: "Swimming pool", icon: "M2 20s2-2 5-2 5 2 8 2 5-2 5-2" },
  { key: "gym", label: "Gym access", icon: "M6 6l-2 2 4 4-4 4 2 2 4-4 4 4 2-2-4-4 4-4-2-2-4 4z" },
  { key: "elevator", label: "Elevator", icon: "M9 4l-4 4 4 4M15 4l4 4-4 4" },
  { key: "balcony", label: "Private balcony", icon: "M3 21h18M5 21V11h4v10M15 21V11h4v10" },
  { key: "seaview", label: "Sea view", icon: "M2 12s2 2 5 2 5-2 5-2 2 2 5 2 5-2 5-2" },
  { key: "beachAccess", label: "Direct beach access", icon: "M2 22h20M3 18l9-12 9 12" },
  { key: "jacuzzi", label: "Jacuzzi", icon: "M2 12h20v5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-5z" },
  { key: "bbq", label: "BBQ", icon: "M5 8h14l-2 13H7zM7 8c0-3 2-5 5-5s5 2 5 5" },
  { key: "garden", label: "Private garden", icon: "M12 22V8M5 12s2-3 7-3 7 3 7 3" },
  { key: "workspace", label: "Dedicated workspace", icon: "M3 12h18M3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" },
  { key: "hairdryer", label: "Hair dryer", icon: "M3 8a4 4 0 0 1 4-4h12l-4 8H7a4 4 0 0 1-4-4zM10 12v8" },
  { key: "iron", label: "Iron", icon: "M5 8h14l-2 6H7zM7 14v6h10v-6" },
  { key: "safe", label: "In-room safe", icon: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" },
  { key: "pets", label: "Pets allowed", icon: "M11 14c0-3-3-5-5-5s-3 2-3 4" },
  { key: "smoking", label: "Smoking allowed", icon: "M3 12h18v3H3z" },
  { key: "events", label: "Events allowed", icon: "M21 11.5a8.38 8.38 0 0 1-9 8.5" },
];

export const MONTHLY_CHART_DATA = [
  { month: "Dec", bookings: 21, amount: 142 },
  { month: "Jan", bookings: 26, amount: 178 },
  { month: "Feb", bookings: 24, amount: 165 },
  { month: "Mar", bookings: 31, amount: 218 },
  { month: "Apr", bookings: 33, amount: 241 },
  { month: "May", bookings: 38, amount: 287, current: true },
];

export const GUEST_TAGS: Record<string, { c: string; l: string }[]> = {
  "G-1042": [{ c: "repeat", l: "Repeat" }],
  "G-2018": [{ c: "repeat", l: "Repeat" }],
  "G-0892": [],
  "G-1577": [{ c: "vip", l: "VIP" }, { c: "repeat", l: "Repeat" }],
  "G-2204": [],
  "G-0331": [{ c: "new", l: "New" }],
};

export const GUEST_LAST_STAY: Record<string, string> = {
  "G-1042": "2 weeks ago",
  "G-2018": "3 days ago",
  "G-0892": "last month",
  "G-1577": "5 days ago",
  "G-2204": "2 months ago",
  "G-0331": "today",
};
