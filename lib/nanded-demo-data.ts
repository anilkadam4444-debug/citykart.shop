import type {
  ArtworkPreset,
  LocalStore,
  Product,
  SellerProfile,
  StoreCategoryId,
  StoreCategoryName,
} from './catalog-data';

export const NANDED_DEMO_BATCH_ID = 'nanded-25-cat-demo-v1';
export const NANDED_DEMO_CREATED_AT = '2026-10-23T07:45:00.000Z';

interface CategoryDemoBlueprint {
  categoryId: StoreCategoryId;
  categoryName: StoreCategoryName;
  artworkPreset: ArtworkPreset;
  storeA: {
    id: string;
    name: string;
    ownerName: string;
    neighborhood: string;
    address: string;
    specialty: string;
    operatingHours: string;
    avgDispatchMins: number;
  };
  storeB: {
    id: string;
    name: string;
    ownerName: string;
    neighborhood: string;
    address: string;
    specialty: string;
    operatingHours: string;
    avgDispatchMins: number;
  };
  products: [
    {
      id: string;
      sku: string;
      name: string;
      priceInr: number;
      unitLabel: string;
      description: string;
      variants: string[];
      stock: number;
      visualKey: string;
    },
    {
      id: string;
      sku: string;
      name: string;
      priceInr: number;
      unitLabel: string;
      description: string;
      variants: string[];
      stock: number;
      visualKey: string;
    },
    {
      id: string;
      sku: string;
      name: string;
      priceInr: number;
      unitLabel: string;
      description: string;
      variants: string[];
      stock: number;
      visualKey: string;
    },
  ];
}

export const NANDED_25_CATEGORY_BLUEPRINTS: CategoryDemoBlueprint[] = [
  // 1. Grocery & Daily Essentials
  {
    categoryId: 'cat-01-grocery-daily-essentials',
    categoryName: 'Grocery & Daily Essentials',
    artworkPreset: 'matcha_ceremonial',
    storeA: {
      id: 'demo-nanded-store-01a',
      name: 'Nanded Fresh Mart (Demo)',
      ownerName: 'Sandeep Deshmukh (Demo)',
      neighborhood: 'Vazirabad',
      address: 'Demo Storefront, Main Bazaar Road, Vazirabad, Nanded',
      specialty: 'Daily staples, grains, pulses, cooking oils & household kirana',
      operatingHours: '07:30 AM – 09:30 PM',
      avgDispatchMins: 25,
    },
    storeB: {
      id: 'demo-nanded-store-01b',
      name: 'Godavari Kirana & Provisions (Demo)',
      ownerName: 'Mahesh Kulkarni (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, Near Shivaji Nagar Chowk, Nanded',
      specialty: 'Rice, wheat flour, spices, dry fruits & daily essentials',
      operatingHours: '08:00 AM – 10:00 PM',
      avgDispatchMins: 28,
    },
    products: [
      {
        id: 'demo-nanded-prod-01a',
        sku: 'ND-GDE-001',
        name: 'Basmati Rice, 1 kg',
        priceInr: 120,
        unitLabel: '1 kg Pack',
        description:
          'Aged long-grain aromatic basmati rice suitable for daily steamed rice, jeera rice, and biryani preparation. (Demo catalog item)',
        variants: ['1 kg Pack', '5 kg Family Pack'],
        stock: 45,
        visualKey: 'basmati_rice',
      },
      {
        id: 'demo-nanded-prod-01b',
        sku: 'ND-GDE-002',
        name: 'Unpolished Arhar / Toor Dal, 1 kg',
        priceInr: 165,
        unitLabel: '1 kg Pouch',
        description:
          'Clean, unpolished Marathwada toor dal rich in natural protein for traditional varan and dal tadka. (Demo catalog item)',
        variants: ['1 kg Pouch', '2 kg Value Pack'],
        stock: 38,
        visualKey: 'toor_dal',
      },
      {
        id: 'demo-nanded-prod-01c',
        sku: 'ND-GDE-003',
        name: 'Filtered Groundnut Cooking Oil, 1 litre',
        priceInr: 210,
        unitLabel: '1 litre Pouch',
        description:
          'Double-filtered pure groundnut oil with natural aroma for everyday Indian cooking and frying. (Demo catalog item)',
        variants: ['1 litre Pouch', '5 litre Jar'],
        stock: 30,
        visualKey: 'cooking_oil',
      },
    ],
  },

  // 2. Fruits & Vegetables
  {
    categoryId: 'cat-02-fruits-vegetables',
    categoryName: 'Fruits & Vegetables',
    artworkPreset: 'sourdough_kit',
    storeA: {
      id: 'demo-nanded-store-02a',
      name: 'Godavari Fruits & Vegetables (Demo)',
      ownerName: 'Rameshwar Jadhav (Demo)',
      neighborhood: 'Taroda Naka',
      address: 'Demo Storefront, Vegetable Market Lane, Taroda Naka, Nanded',
      specialty: 'Seasonal orchard fruits, leafy greens & farm-fresh vegetables',
      operatingHours: '06:30 AM – 09:00 PM',
      avgDispatchMins: 22,
    },
    storeB: {
      id: 'demo-nanded-store-02b',
      name: 'Marathwada Green Harvest Mandi (Demo)',
      ownerName: 'Sunita Shinde (Demo)',
      neighborhood: 'Bhagya Nagar',
      address: 'Demo Storefront, Bhagya Nagar Main Road, Nanded',
      specialty: 'Handpicked local produce, mangoes, pomegranates & herbs',
      operatingHours: '07:00 AM – 09:00 PM',
      avgDispatchMins: 24,
    },
    products: [
      {
        id: 'demo-nanded-prod-02a',
        sku: 'ND-FNV-001',
        name: 'Fresh Alphonso Mangoes, 1 kg',
        priceInr: 180,
        unitLabel: '1 kg (Approx. 4–5 Mangoes)',
        description:
          'Naturally ripened, sweet and pulpy Alphonso mangoes sorted fresh for table consumption and aamras. (Demo catalog item)',
        variants: ['1 kg Box', '2 kg Box'],
        stock: 32,
        visualKey: 'alphonso_mangoes',
      },
      {
        id: 'demo-nanded-prod-02b',
        sku: 'ND-FNV-002',
        name: 'Fresh Bhagwa Pomegranates, 1 kg',
        priceInr: 140,
        unitLabel: '1 kg (4–5 Fruits)',
        description:
          'Ruby-red juicy pomegranates sourced from regional Maharashtra orchards. (Demo catalog item)',
        variants: ['1 kg', '2 kg'],
        stock: 28,
        visualKey: 'pomegranates',
      },
      {
        id: 'demo-nanded-prod-02c',
        sku: 'ND-FNV-003',
        name: 'Daily Kitchen Vegetable Combo (Onion, Tomato, Potato), 3 kg',
        priceInr: 135,
        unitLabel: '3 kg Combo Pack (1 kg each)',
        description:
          'Essential household combo containing 1 kg Nashik red onions, 1 kg farm tomatoes, and 1 kg fresh potatoes. (Demo catalog item)',
        variants: ['3 kg Standard Combo', '6 kg Family Combo'],
        stock: 40,
        visualKey: 'vegetable_basket',
      },
    ],
  },

  // 3. Fashion & Clothing
  {
    categoryId: 'cat-03-fashion-clothing',
    categoryName: 'Fashion & Clothing',
    artworkPreset: 'linen_jacket',
    storeA: {
      id: 'demo-nanded-store-03a',
      name: 'Marathwada Fashion House (Demo)',
      ownerName: 'Nilesh Patwari (Demo)',
      neighborhood: 'Vazirabad',
      address: 'Demo Storefront, Subhash Road, Vazirabad, Nanded',
      specialty: 'Men’s casual wear, cotton shirts, kurtas & family apparel',
      operatingHours: '10:00 AM – 09:30 PM',
      avgDispatchMins: 35,
    },
    storeB: {
      id: 'demo-nanded-store-03b',
      name: 'Nanded Heritage Loom & Attire (Demo)',
      ownerName: 'Pallavi Joshi (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, VIP Road, Shivaji Nagar, Nanded',
      specialty: 'Everyday ethnic wear, breathable cotton kurtis & office wear',
      operatingHours: '10:30 AM – 09:00 PM',
      avgDispatchMins: 35,
    },
    products: [
      {
        id: 'demo-nanded-prod-03a',
        sku: 'ND-FNC-001',
        name: "Men's Cotton Casual Shirt",
        priceInr: 799,
        unitLabel: '1 Shirt (100% Pure Cotton)',
        description:
          'Breathable pure cotton regular-fit casual shirt with button-down collar and chest pocket, ideal for warm weather and daily wear. (Demo catalog item)',
        variants: ['Size M', 'Size L', 'Size XL'],
        stock: 24,
        visualKey: 'cotton_shirt',
      },
      {
        id: 'demo-nanded-prod-03b',
        sku: 'ND-FNC-002',
        name: "Women's Printed Cotton Straight Kurta",
        priceInr: 649,
        unitLabel: '1 Kurta',
        description:
          'Soft cambric cotton straight-cut kurta with subtle block-inspired motifs and three-quarter sleeves. (Demo catalog item)',
        variants: ['Size S', 'Size M', 'Size L', 'Size XL'],
        stock: 20,
        visualKey: 'cotton_kurta',
      },
      {
        id: 'demo-nanded-prod-03c',
        sku: 'ND-FNC-003',
        name: "Men's Classic Stretch Denim Jeans",
        priceInr: 1199,
        unitLabel: '1 Pair',
        description:
          'Mid-rise comfortable cotton-stretch indigo denim trousers with reinforced stitching. (Demo catalog item)',
        variants: ['Waist 30', 'Waist 32', 'Waist 34', 'Waist 36'],
        stock: 18,
        visualKey: 'denim_jeans',
      },
    ],
  },

  // 4. Electronics & Mobile Accessories
  {
    categoryId: 'cat-04-electronics-mobile-accessories',
    categoryName: 'Electronics & Mobile Accessories',
    artworkPreset: 'field_headphones',
    storeA: {
      id: 'demo-nanded-store-04a',
      name: 'CityTech Mobile Store (Demo)',
      ownerName: 'Akash Chavan (Demo)',
      neighborhood: 'Vazirabad',
      address: 'Demo Storefront, Doctor Lane Corner, Vazirabad, Nanded',
      specialty: 'Fast chargers, USB-C cables, earphones, power banks & cases',
      operatingHours: '09:30 AM – 09:30 PM',
      avgDispatchMins: 25,
    },
    storeB: {
      id: 'demo-nanded-store-04b',
      name: 'Godavari Digital & Gadget Hub (Demo)',
      ownerName: 'Rohan Sharma (Demo)',
      neighborhood: 'Anand Nagar',
      address: 'Demo Storefront, Anand Nagar Main Chowk, Nanded',
      specialty: 'Mobile accessories, Bluetooth audio & smart chargers',
      operatingHours: '10:00 AM – 09:30 PM',
      avgDispatchMins: 28,
    },
    products: [
      {
        id: 'demo-nanded-prod-04a',
        sku: 'ND-EMA-001',
        name: 'USB-C Fast Charging Cable',
        priceInr: 249,
        unitLabel: '1.2 metre Braided Cable (60W PD)',
        description:
          'Durable nylon-braided USB-C to USB-C fast charging and data sync cable with reinforced strain relief. (Demo catalog item)',
        variants: ['1.2 metre (Black)', '2 metre (Slate Grey)'],
        stock: 50,
        visualKey: 'usbc_cable',
      },
      {
        id: 'demo-nanded-prod-04b',
        sku: 'ND-EMA-002',
        name: '20W USB-C Power Delivery Wall Charger Adapter',
        priceInr: 549,
        unitLabel: '1 Fast Charger Adapter',
        description:
          'Compact BIS-compliant 20W fast wall adapter with over-voltage protection for smartphones and tablets. (Demo catalog item)',
        variants: ['White Adapter', 'Adapter + Cable Combo'],
        stock: 32,
        visualKey: 'wall_charger',
      },
      {
        id: 'demo-nanded-prod-04c',
        sku: 'ND-EMA-003',
        name: '10,000 mAh Dual-Port Fast Power Bank',
        priceInr: 999,
        unitLabel: '10,000 mAh Lithium-Polymer',
        description:
          'Slim pocket power bank with dual USB output and Type-C input/output for reliable backup charging on the go. (Demo catalog item)',
        variants: ['Matte Black', 'Midnight Blue'],
        stock: 22,
        visualKey: 'power_bank',
      },
    ],
  },

  // 5. Pharmacy & Healthcare Products
  {
    categoryId: 'cat-05-pharmacy-healthcare-products',
    categoryName: 'Pharmacy & Healthcare Products',
    artworkPreset: 'hinoki_serum',
    storeA: {
      id: 'demo-nanded-store-05a',
      name: 'Nanded Health & Wellness (Demo)',
      ownerName: 'Kiran Deshpande (Demo)',
      neighborhood: 'Doctor Lane, Vazirabad',
      address: 'Demo Storefront, Doctor Lane, Vazirabad, Nanded',
      specialty: 'Non-prescription wellness supplies, thermometers & first-aid kits',
      operatingHours: '08:00 AM – 10:30 PM',
      avgDispatchMins: 20,
    },
    storeB: {
      id: 'demo-nanded-store-05b',
      name: 'Sanjeevani Daily Care & Hygiene Store (Demo)',
      ownerName: 'Meenal Kulkarni (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, Hospital Road, Shivaji Nagar, Nanded',
      specialty: 'Home health monitors, cotton dressings & personal hygiene items',
      operatingHours: '08:00 AM – 10:00 PM',
      avgDispatchMins: 22,
    },
    products: [
      {
        id: 'demo-nanded-prod-05a',
        sku: 'ND-PHP-001',
        name: 'Digital Thermometer',
        priceInr: 299,
        unitLabel: '1 Digital Thermometer with Storage Case',
        description:
          'Easy-to-read non-mercury household digital thermometer with beep alert, memory recall, and protective case. Non-prescription demonstration product.',
        variants: ['Standard Tip', 'Flexible Tip'],
        stock: 35,
        visualKey: 'digital_thermometer',
      },
      {
        id: 'demo-nanded-prod-05b',
        sku: 'ND-PHP-002',
        name: 'Household First-Aid Dressing & Bandage Box',
        priceInr: 349,
        unitLabel: '24-Piece Non-Prescription Home First-Aid Kit',
        description:
          'Compact home and travel first-aid organizer containing sterile gauze swabs, adhesive fabric bandages, cotton roll, and medical tape. Non-prescription demo item.',
        variants: ['Home Box (24 pcs)', 'Compact Travel Pouch (14 pcs)'],
        stock: 26,
        visualKey: 'first_aid_kit',
      },
      {
        id: 'demo-nanded-prod-05c',
        sku: 'ND-PHP-003',
        name: 'Ribbed Rubber Hot Water Fomentation Bag',
        priceInr: 220,
        unitLabel: '2 litre Capacity',
        description:
          'Leak-resistant natural rubber hot water bag for soothing warmth and household comfort. Non-prescription demonstration item.',
        variants: ['Red', 'Blue'],
        stock: 30,
        visualKey: 'hot_water_bag',
      },
    ],
  },

  // 6. Bakery, Sweets & Desserts
  {
    categoryId: 'cat-06-bakery-sweets-desserts',
    categoryName: 'Bakery, Sweets & Desserts',
    artworkPreset: 'sourdough_kit',
    storeA: {
      id: 'demo-nanded-store-06a',
      name: 'Shree Ganesh Bakery (Demo)',
      ownerName: 'Ganesh Halwai (Demo)',
      neighborhood: 'Kala Mandir',
      address: 'Demo Storefront, Kala Mandir Road, Nanded',
      specialty: 'Fresh cream pastries, celebration cakes, khari & milk bread',
      operatingHours: '08:00 AM – 10:00 PM',
      avgDispatchMins: 24,
    },
    storeB: {
      id: 'demo-nanded-store-06b',
      name: 'Godavari Mithai & Bakehouse (Demo)',
      ownerName: 'Prakash Joshi (Demo)',
      neighborhood: 'Bhagya Nagar',
      address: 'Demo Storefront, Bhagya Nagar Circle, Nanded',
      specialty: 'Traditional pedha, kaju katli, cookies & fresh bakery snacks',
      operatingHours: '08:30 AM – 10:00 PM',
      avgDispatchMins: 25,
    },
    products: [
      {
        id: 'demo-nanded-prod-06a',
        sku: 'ND-BSD-001',
        name: 'Assorted Fresh Pastries',
        priceInr: 350,
        unitLabel: 'Box of 4 Fresh Pastries',
        description:
          'Eggless bakery pastry box featuring Pineapple, Black Forest, Chocolate Truffle, and Butterscotch slices baked fresh daily. (Demo catalog item)',
        variants: ['Box of 4 Pastries', 'Box of 6 Pastries'],
        stock: 20,
        visualKey: 'assorted_pastries',
      },
      {
        id: 'demo-nanded-prod-06b',
        sku: 'ND-BSD-002',
        name: 'Pure Cashew Kaju Katli Sweet Box, 500 g',
        priceInr: 480,
        unitLabel: '500 g Festive Gift Box',
        description:
          'Smooth diamond-cut kaju katli prepared with premium cashews and minimal sugar in hygienic kitchen batches. (Demo catalog item)',
        variants: ['250 g Box', '500 g Box', '1 kg Box'],
        stock: 25,
        visualKey: 'kaju_katli',
      },
      {
        id: 'demo-nanded-prod-06c',
        sku: 'ND-BSD-003',
        name: 'Crispy Layered Puff Khari & Jeera Butter Biscuits, 400 g',
        priceInr: 140,
        unitLabel: '400 g Bakery Tin Pack',
        description:
          'Oven-fresh flaky puff khari and roasted cumin butter biscuits ideal for evening chai. (Demo catalog item)',
        variants: ['400 g Combo Pack', '250 g Jeera Biscuits'],
        stock: 36,
        visualKey: 'bakery_biscuits',
      },
    ],
  },

  // 7. Restaurants & Food
  {
    categoryId: 'cat-07-restaurants-food',
    categoryName: 'Restaurants & Food',
    artworkPreset: 'sourdough_kit',
    storeA: {
      id: 'demo-nanded-store-07a',
      name: 'Royal Spice Restaurant (Demo)',
      ownerName: 'Vikram Rathod (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, Station Road Link, Shivaji Nagar, Nanded',
      specialty: 'Homestyle Maharashtrian & North Indian thalis, biryanis & curries',
      operatingHours: '11:00 AM – 10:30 PM',
      avgDispatchMins: 28,
    },
    storeB: {
      id: 'demo-nanded-store-07b',
      name: 'Sahyadri Dining Hall & Tiffin Kitchen (Demo)',
      ownerName: 'Anjali Kulkarni (Demo)',
      neighborhood: 'Vishnupuri',
      address: 'Demo Storefront, Vishnupuri College Road, Nanded',
      specialty: 'Fresh vegetarian meals, masala dosa, chapati bhaji & dal khichdi',
      operatingHours: '09:00 AM – 10:00 PM',
      avgDispatchMins: 26,
    },
    products: [
      {
        id: 'demo-nanded-prod-07a',
        sku: 'ND-RNF-001',
        name: 'Veg Thali',
        priceInr: 180,
        unitLabel: 'Full Meal Box (2 Sabzi, Dal Fry, Jeera Rice, 3 Phulkas, Sweet, Salad)',
        description:
          'Wholesome hot vegetarian meal platter packed in spill-proof compartments with paneer masala, seasonal veg, dal tadka, jeera rice, 3 soft wheat phulkas, gulab jamun, and pickle. (Demo catalog item)',
        variants: ['Standard Veg Thali', 'Special Paneer & Sweet Thali'],
        stock: 40,
        visualKey: 'veg_thali',
      },
      {
        id: 'demo-nanded-prod-07b',
        sku: 'ND-RNF-002',
        name: 'Paneer Butter Masala & 3 Butter Tandoori Rotis Combo',
        priceInr: 240,
        unitLabel: '1 Main Course + 3 Rotis',
        description:
          'Rich tomato-cashew gravy with soft malai paneer cubes served alongside three hot tandoori wheat rotis and onion salad. (Demo catalog item)',
        variants: ['Medium Spice', 'Mild Spice'],
        stock: 30,
        visualKey: 'paneer_combo',
      },
      {
        id: 'demo-nanded-prod-07c',
        sku: 'ND-RNF-003',
        name: 'Dal Khichdi with Roasted Papad & Tadka Curd',
        priceInr: 150,
        unitLabel: '500 ml Comfort Bowl',
        description:
          'Comforting moong-toor dal and rice khichdi tempered with pure ghee, garlic, and cumin, served with roasted papad and curd. (Demo catalog item)',
        variants: ['Classic Ghee Tadka', 'Palak Dal Khichdi'],
        stock: 35,
        visualKey: 'dal_khichdi',
      },
    ],
  },

  // 8. Furniture & Home Decor
  {
    categoryId: 'cat-08-furniture-home-decor',
    categoryName: 'Furniture & Home Decor',
    artworkPreset: 'brass_lamp',
    storeA: {
      id: 'demo-nanded-store-08a',
      name: 'Godavari Furniture House (Demo)',
      ownerName: 'Rajendra Soni (Demo)',
      neighborhood: 'Hyderbagh',
      address: 'Demo Storefront, MIDC Link Road, Hyderbagh, Nanded',
      specialty: 'Solid wood coffee tables, study desks, chairs & living room decor',
      operatingHours: '10:00 AM – 09:00 PM',
      avgDispatchMins: 45,
    },
    storeB: {
      id: 'demo-nanded-store-08b',
      name: 'Nanded Home Living & Interiors (Demo)',
      ownerName: 'Sneha अग्रवाल (Demo)',
      neighborhood: 'Srinagar',
      address: 'Demo Storefront, Srinagar Main Road, Nanded',
      specialty: 'Table lamps, cushions, woven rugs, bookshelves & wall mirrors',
      operatingHours: '10:30 AM – 09:00 PM',
      avgDispatchMins: 40,
    },
    products: [
      {
        id: 'demo-nanded-prod-08a',
        sku: 'ND-FHD-001',
        name: 'Wooden Coffee Table',
        priceInr: 4999,
        unitLabel: '90 cm × 55 cm × 45 cm (Seasoned Sheesham Wood)',
        description:
          'Sturdy rectangular living-room center coffee table crafted from seasoned hardwood with a lower magazine shelf and warm natural matte finish. (Demo catalog item)',
        variants: ['Natural Teak Finish', 'Warm Walnut Finish'],
        stock: 8,
        visualKey: 'wooden_coffee_table',
      },
      {
        id: 'demo-nanded-prod-08b',
        sku: 'ND-FHD-002',
        name: 'Warm Brass & Linen Bedside Table Lamp',
        priceInr: 1299,
        unitLabel: '38 cm Height (LED Bulb Included)',
        description:
          'Minimalist brushed-brass base table lamp with an unbleached cotton-linen drum shade for warm ambient reading light. (Demo catalog item)',
        variants: ['Warm White LED', 'Amber Filament LED'],
        stock: 15,
        visualKey: 'table_lamp',
      },
      {
        id: 'demo-nanded-prod-08c',
        sku: 'ND-FHD-003',
        name: 'Handwoven Cotton Dhurrie Floor Rug (4 × 6 ft)',
        priceInr: 1499,
        unitLabel: '120 cm × 180 cm Reversible Flatweave',
        description:
          'Washable flatweave cotton floor rug in earthy terracotta and ivory geometric patterns for living rooms and bedrooms. (Demo catalog item)',
        variants: ['Terracotta & Ivory', 'Indigo & Sand'],
        stock: 12,
        visualKey: 'cotton_rug',
      },
    ],
  },

  // 9. Hardware, Electricals & Plumbing
  {
    categoryId: 'cat-09-hardware-electricals-plumbing',
    categoryName: 'Hardware, Electricals & Plumbing',
    artworkPreset: 'brass_lamp',
    storeA: {
      id: 'demo-nanded-store-09a',
      name: 'Maharashtra Hardware Centre (Demo)',
      ownerName: 'Dilip Kadam (Demo)',
      neighborhood: 'WorkShop Corner',
      address: 'Demo Storefront, WorkShop Corner Main Road, Nanded',
      specialty: 'Hand tools, plumbing wrenches, taps, locks & fasteners',
      operatingHours: '09:00 AM – 08:30 PM',
      avgDispatchMins: 30,
    },
    storeB: {
      id: 'demo-nanded-store-09b',
      name: 'Nanded Electricals & Sanitaryware Mart (Demo)',
      ownerName: 'Harish Bora (Demo)',
      neighborhood: 'Vazirabad',
      address: 'Demo Storefront, Old Mondha Road, Nanded',
      specialty: 'LED lighting, switches, cables, PVC fittings & bathroom fixtures',
      operatingHours: '09:30 AM – 08:30 PM',
      avgDispatchMins: 30,
    },
    products: [
      {
        id: 'demo-nanded-prod-09a',
        sku: 'ND-HEP-001',
        name: 'Adjustable Pipe Wrench',
        priceInr: 450,
        unitLabel: '10-inch Heavy-Duty Forged Steel Wrench',
        description:
          'Drop-forged chrome-vanadium steel plumbing pipe wrench with induction-hardened jaws and knurled adjustment nut for household and workshop repairs. (Demo catalog item)',
        variants: ['10-inch (250 mm)', '12-inch (300 mm)'],
        stock: 22,
        visualKey: 'pipe_wrench',
      },
      {
        id: 'demo-nanded-prod-09b',
        sku: 'ND-HEP-002',
        name: '9W Cool Daylight LED Bulbs (Pack of 4)',
        priceInr: 360,
        unitLabel: 'Pack of 4 B22 Pin LED Bulbs',
        description:
          'Energy-saving 9-watt B22 base LED bulbs with 4kV surge protection and bright 6500K daylight illumination. (Demo catalog item)',
        variants: ['Cool Daylight (6500K)', 'Warm White (3000K)'],
        stock: 40,
        visualKey: 'led_bulbs',
      },
      {
        id: 'demo-nanded-prod-09c',
        sku: 'ND-HEP-003',
        name: 'Household 8-Piece Screwdriver & Tester Tool Kit',
        priceInr: 320,
        unitLabel: '8-Piece Insulated Tool Case',
        description:
          'Compact domestic maintenance kit with interchangeable Phillips and flathead blades, line tester, and insulated handle. (Demo catalog item)',
        variants: ['8-Piece Set'],
        stock: 25,
        visualKey: 'screwdriver_kit',
      },
    ],
  },

  // 10. Beauty & Personal Care
  {
    categoryId: 'cat-10-beauty-personal-care',
    categoryName: 'Beauty & Personal Care',
    artworkPreset: 'hinoki_serum',
    storeA: {
      id: 'demo-nanded-store-10a',
      name: 'Urban Beauty Studio (Demo)',
      ownerName: 'Pooja Chavan (Demo)',
      neighborhood: 'Bhagya Nagar',
      address: 'Demo Storefront, Bhagya Nagar Commercial Lane, Nanded',
      specialty: 'Skincare, herbal face washes, hair oils, sunscreens & grooming',
      operatingHours: '10:00 AM – 09:00 PM',
      avgDispatchMins: 25,
    },
    storeB: {
      id: 'demo-nanded-store-10b',
      name: 'Aura Herbal & Personal Care Shoppe (Demo)',
      ownerName: 'Swati Deshmukh (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, Near Science College Road, Nanded',
      specialty: 'Botanical bath care, aloe vera gels, shampoos & daily grooming',
      operatingHours: '10:00 AM – 09:00 PM',
      avgDispatchMins: 26,
    },
    products: [
      {
        id: 'demo-nanded-prod-10a',
        sku: 'ND-BPC-001',
        name: 'Aloe Vera Face Wash',
        priceInr: 199,
        unitLabel: '150 ml Gentle Foaming Tube',
        description:
          'Refreshing paraben-free daily face cleanser enriched with soothing aloe vera extract and cucumber for hydrated, clean skin. (Demo catalog item)',
        variants: ['150 ml Tube', '2 × 150 ml Twin Pack'],
        stock: 38,
        visualKey: 'aloe_face_wash',
      },
      {
        id: 'demo-nanded-prod-10b',
        sku: 'ND-BPC-002',
        name: 'Cold-Pressed Almond & Hibiscus Nourishing Hair Oil, 200 ml',
        priceInr: 225,
        unitLabel: '200 ml Bottle with Comb Applicator',
        description:
          'Non-sticky herbal hair oil blended with sweet almond, coconut, and hibiscus flower extracts. (Demo catalog item)',
        variants: ['200 ml Bottle'],
        stock: 28,
        visualKey: 'hair_oil',
      },
      {
        id: 'demo-nanded-prod-10c',
        sku: 'ND-BPC-003',
        name: 'Sandalwood & Turmeric Moisturizing Bath Soap (Pack of 3)',
        priceInr: 165,
        unitLabel: '3 × 100 g Bars',
        description:
          'Triple-milled vegetable oil bath bars infused with aromatic sandalwood and wild turmeric. (Demo catalog item)',
        variants: ['Pack of 3 Bars', 'Pack of 6 Bars'],
        stock: 34,
        visualKey: 'bath_soap',
      },
    ],
  },

  // 11. Footwear & Bags
  {
    categoryId: 'cat-11-footwear-bags',
    categoryName: 'Footwear & Bags',
    artworkPreset: 'leather_totebag',
    storeA: {
      id: 'demo-nanded-store-11a',
      name: 'Nanded StepWell Footwear & Bags (Demo)',
      ownerName: 'Imran Shaikh (Demo)',
      neighborhood: 'Vazirabad',
      address: 'Demo Storefront,MG Road Crossing, Vazirabad, Nanded',
      specialty: 'Casual sneakers, walking sandals, school backpacks & travel bags',
      operatingHours: '10:00 AM – 09:30 PM',
      avgDispatchMins: 32,
    },
    storeB: {
      id: 'demo-nanded-store-11b',
      name: 'Marathwada Luggage & Shoe Emporium (Demo)',
      ownerName: 'Nitin Jain (Demo)',
      neighborhood: 'Kala Mandir',
      address: 'Demo Storefront, Kala Mandir Chowk, Nanded',
      specialty: 'Everyday family footwear, office laptop bags & duffels',
      operatingHours: '10:00 AM – 09:30 PM',
      avgDispatchMins: 34,
    },
    products: [
      {
        id: 'demo-nanded-prod-11a',
        sku: 'ND-FWB-001',
        name: 'Everyday Casual Sneakers',
        priceInr: 1199,
        unitLabel: '1 Pair (Cushioned EVA Sole)',
        description:
          'Lightweight breathable knit and faux-suede everyday lace-up sneakers with cushioned insoles and slip-resistant rubber outsoles. (Demo catalog item)',
        variants: ['UK 7', 'UK 8', 'UK 9', 'UK 10'],
        stock: 18,
        visualKey: 'casual_sneakers',
      },
      {
        id: 'demo-nanded-prod-11b',
        sku: 'ND-FWB-002',
        name: 'Water-Resistant 15.6" Laptop & College Backpack (28L)',
        priceInr: 899,
        unitLabel: '28 Litre Capacity',
        description:
          'Ergonomic daily commuter backpack with padded laptop compartment, dual bottle pockets, and rain-resistant polyester fabric. (Demo catalog item)',
        variants: ['Charcoal Grey', 'Navy Blue'],
        stock: 22,
        visualKey: 'laptop_backpack',
      },
      {
        id: 'demo-nanded-prod-11c',
        sku: 'ND-FWB-003',
        name: 'Comfort Grip Daily Walking Sandals',
        priceInr: 649,
        unitLabel: '1 Pair',
        description:
          'Adjustable velcro-strap cushioned sandals designed for all-day walking comfort and monsoon durability. (Demo catalog item)',
        variants: ['UK 7', 'UK 8', 'UK 9', 'UK 10'],
        stock: 25,
        visualKey: 'walking_sandals',
      },
    ],
  },

  // 12. Books, Stationery & Office Supplies
  {
    categoryId: 'cat-12-books-stationery-office-supplies',
    categoryName: 'Books, Stationery & Office Supplies',
    artworkPreset: 'ceramic_pourover',
    storeA: {
      id: 'demo-nanded-store-12a',
      name: 'Saraswati Books & Stationery Mart (Demo)',
      ownerName: 'Vivek Pande (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, Coaching Hub Lane, Shivaji Nagar, Nanded',
      specialty: 'Academic notebooks, pens, calculators, art supplies & exam guides',
      operatingHours: '08:30 AM – 09:30 PM',
      avgDispatchMins: 22,
    },
    storeB: {
      id: 'demo-nanded-store-12b',
      name: 'Vishnupuri Student & Office Depot (Demo)',
      ownerName: 'Suresh More (Demo)',
      neighborhood: 'Vishnupuri',
      address: 'Demo Storefront, Near University Gate, Vishnupuri, Nanded',
      specialty: 'A4 paper reams, files, notebooks & engineering drawing sets',
      operatingHours: '09:00 AM – 09:00 PM',
      avgDispatchMins: 24,
    },
    products: [
      {
        id: 'demo-nanded-prod-12a',
        sku: 'ND-BSO-001',
        name: 'A4 Notebook, 200 Pages',
        priceInr: 85,
        unitLabel: '1 Notebook (Single-Ruled 70 GSM Bright Paper)',
        description:
          'Sturdy soft-cover A4 register notebook with 200 smooth single-ruled pages for college notes, exam preparation, and office records. (Demo catalog item)',
        variants: ['Single Ruled (1 pc)', 'Pack of 5 Notebooks'],
        stock: 60,
        visualKey: 'a4_notebook',
      },
      {
        id: 'demo-nanded-prod-12b',
        sku: 'ND-BSO-002',
        name: 'Smooth 0.6mm Blue & Black Gel Pen Set (Pack of 10)',
        priceInr: 140,
        unitLabel: 'Pack of 10 Pens (7 Blue + 3 Black)',
        description:
          'Quick-drying waterproof ink gel pens with rubberized comfort grip for long writing sessions. (Demo catalog item)',
        variants: ['Blue + Black Combo', 'All Blue (10 pcs)'],
        stock: 48,
        visualKey: 'gel_pen_set',
      },
      {
        id: 'demo-nanded-prod-12c',
        sku: 'ND-BSO-003',
        name: 'Mesh Metal Desk Organizer & File Tray Combo',
        priceInr: 349,
        unitLabel: '2-Piece Office Desk Set',
        description:
          'Powder-coated steel mesh pen caddy and A4 document organizer for study tables and office desks. (Demo catalog item)',
        variants: ['Matte Black'],
        stock: 20,
        visualKey: 'desk_organizer',
      },
    ],
  },

  // 13. Toys, Games & Baby Products
  {
    categoryId: 'cat-13-toys-games-baby-products',
    categoryName: 'Toys, Games & Baby Products',
    artworkPreset: 'ceramic_pourover',
    storeA: {
      id: 'demo-nanded-store-13a',
      name: 'Little Star Toys & Baby World (Demo)',
      ownerName: 'Pankaj Agrawal (Demo)',
      neighborhood: 'Bhagya Nagar',
      address: 'Demo Storefront, Bhagya Nagar Main Road, Nanded',
      specialty: 'Educational building blocks, board games, puzzles & infant care',
      operatingHours: '10:00 AM – 09:00 PM',
      avgDispatchMins: 28,
    },
    storeB: {
      id: 'demo-nanded-store-13b',
      name: 'Nanded Junior Joy & Kids Corner (Demo)',
      ownerName: 'Rashmi Kulkarni (Demo)',
      neighborhood: 'Anand Nagar',
      address: 'Demo Storefront, Anand Nagar Arcade, Nanded',
      specialty: 'Baby cotton swaddles, wooden toys & family indoor games',
      operatingHours: '10:00 AM – 09:00 PM',
      avgDispatchMins: 30,
    },
    products: [
      {
        id: 'demo-nanded-prod-13a',
        sku: 'ND-TGB-001',
        name: 'Building Blocks Set',
        priceInr: 499,
        unitLabel: '88-Piece Non-Toxic Interlocking Block Bucket',
        description:
          'Colorful BPA-free ABS plastic interlocking building blocks with wheeled baseplates and storage tub for creative play (Ages 3+). (Demo catalog item)',
        variants: ['88-Piece Tub', '120-Piece Deluxe Set'],
        stock: 24,
        visualKey: 'building_blocks',
      },
      {
        id: 'demo-nanded-prod-13b',
        sku: 'ND-TGB-002',
        name: 'Foldable Magnetic Chess & Ludo 2-in-1 Family Board Game',
        priceInr: 399,
        unitLabel: '12-inch Travel & Home Board Set',
        description:
          'Classic magnetic Staunton chess pieces with a reversible Ludo & Snakes-and-Ladders family board. (Demo catalog item)',
        variants: ['Standard 12-inch'],
        stock: 20,
        visualKey: 'chess_board',
      },
      {
        id: 'demo-nanded-prod-13c',
        sku: 'ND-TGB-003',
        name: 'Organic Muslin Cotton Baby Swaddle Wraps (Pack of 3)',
        priceInr: 449,
        unitLabel: '3 × (100 cm × 100 cm) Breathable Cotton Wraps',
        description:
          'Ultra-soft pre-washed 100% cotton muslin wraps gentle on newborn skin. (Demo catalog item)',
        variants: ['Pastel Clouds & Stars', 'Botanical Mint'],
        stock: 26,
        visualKey: 'baby_swaddle',
      },
    ],
  },

  // 14. Jewellery & Watches
  {
    categoryId: 'cat-14-jewellery-watches',
    categoryName: 'Jewellery & Watches',
    artworkPreset: 'brass_lamp',
    storeA: {
      id: 'demo-nanded-store-14a',
      name: 'Nanded Timepiece & Ornament Gallery (Demo)',
      ownerName: 'Abhijit Saraf (Demo)',
      neighborhood: 'Sarafa Bazaar, Vazirabad',
      address: 'Demo Storefront, Sarafa Line, Vazirabad, Nanded',
      specialty: 'Quartz analog wristwatches, wall clocks & festive imitation jewellery',
      operatingHours: '10:30 AM – 09:00 PM',
      avgDispatchMins: 30,
    },
    storeB: {
      id: 'demo-nanded-store-14b',
      name: 'Royal Crown Watches & Fashion Jewellery (Demo)',
      ownerName: 'NehaZaveri (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, Shivaji Nagar Market, Nanded',
      specialty: 'Gift watches, traditional Maharashtrian nath & pearl sets',
      operatingHours: '10:30 AM – 09:00 PM',
      avgDispatchMins: 30,
    },
    products: [
      {
        id: 'demo-nanded-prod-14a',
        sku: 'ND-JNW-001',
        name: 'Classic Analog Wristwatch',
        priceInr: 899,
        unitLabel: '1 Quartz Watch in Gift Box (Water-Resistant 3 ATM)',
        description:
          'Timeless minimalist dial quartz analog wristwatch with Japanese movement, mineral glass crystal, and stitched genuine leather strap. (Demo catalog item)',
        variants: ['Ivory Dial / Brown Strap', 'Black Dial / Tan Strap'],
        stock: 16,
        visualKey: 'analog_wristwatch',
      },
      {
        id: 'demo-nanded-prod-14b',
        sku: 'ND-JNW-002',
        name: 'Traditional Pearl & Gold-Toned Jhumka Earrings',
        priceInr: 449,
        unitLabel: '1 Pair in Velvet Jewellery Box',
        description:
          'Handcrafted festive jhumka drop earrings adorned with faux pearls and antique gold-tone plating. (Demo catalog item)',
        variants: ['Antique Gold & Pearl', 'Rose Gold & Ruby'],
        stock: 22,
        visualKey: 'jhumka_earrings',
      },
      {
        id: 'demo-nanded-prod-14c',
        sku: 'ND-JNW-003',
        name: 'Silent Sweep Wall Clock (30 cm)',
        priceInr: 599,
        unitLabel: '30 cm Diameter Non-Ticking Quartz Clock',
        description:
          'Clear bold-numeral wall clock with silent sweep movement for living rooms and offices. (Demo catalog item)',
        variants: ['Wood Grain Frame', 'Brushed Silver Frame'],
        stock: 18,
        visualKey: 'wall_clock',
      },
    ],
  },

  // 15. Automotive & Two-Wheeler Accessories
  {
    categoryId: 'cat-15-automotive-two-wheeler-accessories',
    categoryName: 'Automotive & Two-Wheeler Accessories',
    artworkPreset: 'field_headphones',
    storeA: {
      id: 'demo-nanded-store-15a',
      name: 'Nanded MotoCare & Riders Hub (Demo)',
      ownerName: 'Sameer Pathan (Demo)',
      neighborhood: 'WorkShop Corner',
      address: 'Demo Storefront, Hingoli Gate Road, WorkShop Corner, Nanded',
      specialty: 'Two-wheeler phone mounts, helmets, seat covers & bike care',
      operatingHours: '09:30 AM – 09:00 PM',
      avgDispatchMins: 28,
    },
    storeB: {
      id: 'demo-nanded-store-15b',
      name: 'Highway Auto & Bike Accessories (Demo)',
      ownerName: 'Yogesh Pawar (Demo)',
      neighborhood: 'Taroda Naka',
      address: 'Demo Storefront, Ring Road, Taroda Naka, Nanded',
      specialty: 'Car cleaning kits, tyre inflators, bike covers & riding gear',
      operatingHours: '09:30 AM – 08:30 PM',
      avgDispatchMins: 30,
    },
    products: [
      {
        id: 'demo-nanded-prod-15a',
        sku: 'ND-ATA-001',
        name: 'Two-Wheeler Phone Holder',
        priceInr: 349,
        unitLabel: '360° Rotatable Metal Handlebar & Mirror Mount',
        description:
          'Vibration-damped aluminum alloy handlebar and mirror mount phone cradle compatible with 4.7" to 6.8" smartphones for safe GPS navigation. (Demo catalog item)',
        variants: ['Handlebar Clamp Mount', 'Rear-View Mirror Mount'],
        stock: 30,
        visualKey: 'phone_holder',
      },
      {
        id: 'demo-nanded-prod-15b',
        sku: 'ND-ATA-002',
        name: 'Waterproof UV-Resistant Two-Wheeler Body Cover',
        priceInr: 399,
        unitLabel: 'Universal Scooter & Motorcycle Fit with Buckle Strap',
        description:
          'All-weather silver-coated polyester bike cover with mirror pockets and windproof bottom buckle. (Demo catalog item)',
        variants: ['Scooter / Activa Size', 'Standard Motorcycle Size'],
        stock: 28,
        visualKey: 'bike_cover',
      },
      {
        id: 'demo-nanded-prod-15c',
        sku: 'ND-ATA-003',
        name: 'High-GSM Microfiber Car & Bike Wash Cloths (Pack of 4)',
        priceInr: 249,
        unitLabel: '4 × (40 cm × 40 cm) Plush 400 GSM Towels',
        description:
          'Lint-free scratch-safe microfiber detailing cloths for wet washing, waxing, and glass cleaning. (Demo catalog item)',
        variants: ['Pack of 4 Assorted Colors'],
        stock: 35,
        visualKey: 'microfiber_cloths',
      },
    ],
  },

  // 16. Pet Supplies
  {
    categoryId: 'cat-16-pet-supplies',
    categoryName: 'Pet Supplies',
    artworkPreset: 'matcha_ceremonial',
    storeA: {
      id: 'demo-nanded-store-16a',
      name: 'Nanded Pet Care & Paws Corner (Demo)',
      ownerName: 'Dr. Rohit Kadam (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, ITI Road, Shivaji Nagar, Nanded',
      specialty: 'Dog & cat nutrition, chew toys, collars, leashes & grooming',
      operatingHours: '09:30 AM – 09:00 PM',
      avgDispatchMins: 26,
    },
    storeB: {
      id: 'demo-nanded-store-16b',
      name: 'Happy Tails Pet Provision Store (Demo)',
      ownerName: 'Priyanka Joshi (Demo)',
      neighborhood: 'Bhagya Nagar',
      address: 'Demo Storefront, VIP Road Extension, Bhagya Nagar, Nanded',
      specialty: 'Adult & puppy kibble, stainless steel bowls & pet shampoos',
      operatingHours: '10:00 AM – 08:30 PM',
      avgDispatchMins: 28,
    },
    products: [
      {
        id: 'demo-nanded-prod-16a',
        sku: 'ND-PET-001',
        name: 'Adult Dog Food, 1 kg',
        priceInr: 299,
        unitLabel: '1 kg Resealable Nutrition Pack (Chicken & Vegetables)',
        description:
          'Complete and balanced crunchy kibble formulated with protein, omega fatty acids, calcium, and vitamins for healthy adult dogs. (Demo catalog item)',
        variants: ['1 kg Pack', '3 kg Value Bag'],
        stock: 28,
        visualKey: 'dog_food',
      },
      {
        id: 'demo-nanded-prod-16b',
        sku: 'ND-PET-002',
        name: 'Padded Nylon Dog Collar & 1.5m Walk Leash Set',
        priceInr: 349,
        unitLabel: '1 Collar + 1 Matching Leash',
        description:
          'Soft neoprene-padded adjustable collar with heavy-duty metal snap hook leash for comfortable daily walks. (Demo catalog item)',
        variants: ['Medium (Neck 35–48 cm)', 'Large (Neck 45–60 cm)'],
        stock: 20,
        visualKey: 'pet_leash',
      },
      {
        id: 'demo-nanded-prod-16c',
        sku: 'ND-PET-003',
        name: 'Non-Slip Stainless Steel Pet Feeding Bowls (Set of 2)',
        priceInr: 279,
        unitLabel: '2 × 700 ml Food & Water Bowls',
        description:
          'Rust-resistant mirror-finish steel bowls with removable rubber base rings to prevent tipping and skidding. (Demo catalog item)',
        variants: ['700 ml Pair', '1200 ml Large Pair'],
        stock: 24,
        visualKey: 'pet_bowls',
      },
    ],
  },

  // 17. Sports & Fitness
  {
    categoryId: 'cat-17-sports-fitness',
    categoryName: 'Sports & Fitness',
    artworkPreset: 'leather_totebag',
    storeA: {
      id: 'demo-nanded-store-17a',
      name: 'Champion Sports & Fitness Arena (Demo)',
      ownerName: 'Sachin Suryawanshi (Demo)',
      neighborhood: 'Stadium Road, Vazirabad',
      address: 'Demo Storefront, Near Guru Gobind Singh Stadium, Nanded',
      specialty: 'Home gym accessories, cricket gear, badminton racquets & yoga mats',
      operatingHours: '09:00 AM – 09:00 PM',
      avgDispatchMins: 26,
    },
    storeB: {
      id: 'demo-nanded-store-17b',
      name: 'Marathwada Athletics & Active Store (Demo)',
      ownerName: 'Kunal Deshmukh (Demo)',
      neighborhood: 'Taroda Naka',
      address: 'Demo Storefront, Taroda Naka Sports Complex Lane, Nanded',
      specialty: 'Hand grippers, resistance bands, footballs & fitness gear',
      operatingHours: '09:30 AM – 09:00 PM',
      avgDispatchMins: 28,
    },
    products: [
      {
        id: 'demo-nanded-prod-17a',
        sku: 'ND-SNF-001',
        name: 'Adjustable Hand Gripper',
        priceInr: 199,
        unitLabel: '10 kg – 60 kg Adjustable Resistance with Counter',
        description:
          'Ergonomic non-slip forearm and wrist strengthener with carbon-steel tension spring and mechanical repetition counter. (Demo catalog item)',
        variants: ['Black & Orange (with Counter)', 'All Black'],
        stock: 40,
        visualKey: 'hand_gripper',
      },
      {
        id: 'demo-nanded-prod-17b',
        sku: 'ND-SNF-002',
        name: 'Anti-Slip 6mm Cushioned Yoga & Floor Exercise Mat',
        priceInr: 599,
        unitLabel: '183 cm × 61 cm (Carry Strap Included)',
        description:
          'High-density tear-resistant textured yoga mat providing joint cushioning for surya namaskar, stretching, and home workouts. (Demo catalog item)',
        variants: ['Forest Green', 'Deep Indigo'],
        stock: 22,
        visualKey: 'yoga_mat',
      },
      {
        id: 'demo-nanded-prod-17c',
        sku: 'ND-SNF-003',
        name: 'Full-Size Popular Willow Tennis-Ball Cricket Bat',
        priceInr: 799,
        unitLabel: 'Full Size (Short Handle) + Bat Cover',
        description:
          'Well-balanced lightweight willow cricket bat designed for hard and soft tennis-ball matches with cushioned rubber grip. (Demo catalog item)',
        variants: ['Full Size SH', 'Size 6 Youth'],
        stock: 16,
        visualKey: 'cricket_bat',
      },
    ],
  },

  // 18. Home & Kitchen Appliances
  {
    categoryId: 'cat-18-home-kitchen-appliances',
    categoryName: 'Home & Kitchen Appliances',
    artworkPreset: 'espresso_machine',
    storeA: {
      id: 'demo-nanded-store-18a',
      name: 'Godavari Kitchen & Home Appliances (Demo)',
      ownerName: 'Manoj Kabra (Demo)',
      neighborhood: 'Vazirabad',
      address: 'Demo Storefront, Subhash Road Appliance Market, Nanded',
      specialty: 'Electric kettles, mixer grinders, induction cooktops & irons',
      operatingHours: '10:00 AM – 09:00 PM',
      avgDispatchMins: 32,
    },
    storeB: {
      id: 'demo-nanded-store-18b',
      name: 'Nanded Modern Griha Appliances (Demo)',
      ownerName: 'DeepakLahoti (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, Shivaji Nagar Main Road, Nanded',
      specialty: 'Pressure cookers, steel cookware, toasters & small appliances',
      operatingHours: '10:00 AM – 09:00 PM',
      avgDispatchMins: 34,
    },
    products: [
      {
        id: 'demo-nanded-prod-18a',
        sku: 'ND-HKA-001',
        name: 'Electric Kettle',
        priceInr: 999,
        unitLabel: '1.5 Litre Stainless Steel (1500W Auto Cut-Off)',
        description:
          'Rapid-boil 1500W food-grade stainless steel cordless electric kettle with boil-dry protection, 360° swivel power base, and cool-touch handle. (Demo catalog item)',
        variants: ['1.5 Litre Silver & Black', '1.8 Litre Family Size'],
        stock: 20,
        visualKey: 'electric_kettle',
      },
      {
        id: 'demo-nanded-prod-18b',
        sku: 'ND-HKA-002',
        name: '1000W Non-Stick Dry Iron Press with Thermostat Dial',
        priceInr: 749,
        unitLabel: '1000W ISI-Marked Household Iron',
        description:
          'Lightweight fast-heating dry iron with Golden PTFE non-stick soleplate and 5 fabric temperature settings. (Demo catalog item)',
        variants: ['White & Blue'],
        stock: 24,
        visualKey: 'dry_iron',
      },
      {
        id: 'demo-nanded-prod-18c',
        sku: 'ND-HKA-003',
        name: 'Tri-Ply Stainless Steel Outer-Lid Pressure Cooker (3 Litre)',
        priceInr: 1499,
        unitLabel: '3 Litre (Induction & Gas Compatible)',
        description:
          'Heavy-base stainless steel pressure cooker with metallic safety plug and gasket release system for everyday dal and rice. (Demo catalog item)',
        variants: ['3 Litre', '5 Litre'],
        stock: 15,
        visualKey: 'pressure_cooker',
      },
    ],
  },

  // 19. Gifts, Flowers & Handicrafts
  {
    categoryId: 'cat-19-gifts-flowers-handicrafts',
    categoryName: 'Gifts, Flowers & Handicrafts',
    artworkPreset: 'ceramic_pourover',
    storeA: {
      id: 'demo-nanded-store-19a',
      name: 'Nanded Bloom & Gift Boutique (Demo)',
      ownerName: 'komal Deshmukh (Demo)',
      neighborhood: 'Bhagya Nagar',
      address: 'Demo Storefront, Florist Lane, Bhagya Nagar, Nanded',
      specialty: 'Fresh rose bouquets, greeting hampers, photo frames & tabletop gifts',
      operatingHours: '08:00 AM – 09:30 PM',
      avgDispatchMins: 25,
    },
    storeB: {
      id: 'demo-nanded-store-19b',
      name: 'Utsav Florist & Curio Studio (Demo)',
      ownerName: 'Tushar Kale (Demo)',
      neighborhood: 'Kala Mandir',
      address: 'Demo Storefront, Near Kala Mandir Circle, Nanded',
      specialty: 'Anniversary flower arrangements, festive diyas & souvenir gifts',
      operatingHours: '08:30 AM – 09:30 PM',
      avgDispatchMins: 26,
    },
    products: [
      {
        id: 'demo-nanded-prod-19a',
        sku: 'ND-GFH-001',
        name: 'Fresh Flower Bouquet',
        priceInr: 499,
        unitLabel: '12 Fresh Roses with Baby’s Breath & Kraft Gift Wrap',
        description:
          'Hand-tied bouquet of 12 fresh long-stemmed roses accented with white gypsophila foliage, wrapped in pastel kraft paper with satin ribbon and greeting card. (Demo catalog item)',
        variants: ['Red & Pink Roses', 'Yellow & White Roses'],
        stock: 18,
        visualKey: 'flower_bouquet',
      },
      {
        id: 'demo-nanded-prod-19b',
        sku: 'ND-GFH-002',
        name: 'Carved Brass Kamakshi Diya & Festive Gift Box',
        priceInr: 649,
        unitLabel: '1 Solid Brass Oil Lamp in Velvet Gift Box',
        description:
          'Traditional polished brass oil lamp ideal for housewarming, wedding return gifts, and festive puja decor. (Demo catalog item)',
        variants: ['Standard 14 cm Height'],
        stock: 22,
        visualKey: 'brass_diya',
      },
      {
        id: 'demo-nanded-prod-19c',
        sku: 'ND-GFH-003',
        name: 'Glazed Ceramic Tabletop Planter Pot with Bamboo Tray',
        priceInr: 349,
        unitLabel: '14 cm Diameter Ceramic Pot + Saucer',
        description:
          'Speckled stoneware indoor succulent and money-plant pot with drainage hole and natural bamboo drip tray. (Demo catalog item)',
        variants: ['Sage Green', 'Warm Terracotta'],
        stock: 25,
        visualKey: 'ceramic_planter',
      },
    ],
  },

  // 20. Fabrics, Tailoring & Textiles
  {
    categoryId: 'cat-20-fabrics-tailoring-textiles',
    categoryName: 'Fabrics, Tailoring & Textiles',
    artworkPreset: 'linen_jacket',
    storeA: {
      id: 'demo-nanded-store-20a',
      name: 'Nanded Cloth & Textile Emporium (Demo)',
      ownerName: 'Rajeshwar Baheti (Demo)',
      neighborhood: 'Kapad Bazaar, Vazirabad',
      address: 'Demo Storefront, Kapad Line, Vazirabad, Nanded',
      specialty: 'Unstitched cotton dress fabrics, shirting, suiting & lining cloth',
      operatingHours: '10:00 AM – 09:00 PM',
      avgDispatchMins: 32,
    },
    storeB: {
      id: 'demo-nanded-store-20b',
      name: 'Godavari Looms & Tailoring Material Store (Demo)',
      ownerName: 'Savita Kadam (Demo)',
      neighborhood: 'ITwara',
      address: 'Demo Storefront, Old Cloth Market, ITwara, Nanded',
      specialty: 'Cotton blouse pieces, embroidery threads, laces & tailoring tools',
      operatingHours: '10:00 AM – 08:30 PM',
      avgDispatchMins: 34,
    },
    products: [
      {
        id: 'demo-nanded-prod-20a',
        sku: 'ND-FTT-001',
        name: 'Cotton Dress Fabric, 1 metre',
        priceInr: 250,
        unitLabel: '1 metre Cut (44-inch Width · 100% Pure Combed Cotton)',
        description:
          'Soft, colorfast 60×60 cambric cotton unstitched fabric suitable for kurtas, dresses, shirts, and summer garments. Sold in multiples of 1 metre. (Demo catalog item)',
        variants: ['Indigo Floral Block Print', 'Ivory & Maroon Ajrakh Motif', 'Pastel Sage Solid'],
        stock: 45,
        visualKey: 'cotton_fabric',
      },
      {
        id: 'demo-nanded-prod-20b',
        sku: 'ND-FTT-002',
        name: 'Tailoring Scissors, Measuring Tape & 24-Spool Thread Box',
        priceInr: 320,
        unitLabel: 'Complete Home Sewing & Tailoring Kit',
        description:
          '8-inch carbon steel fabric shears paired with a 60-inch fiberglass tape, seam ripper, needles, and 24 assorted polyester thread spools. (Demo catalog item)',
        variants: ['Standard Kit'],
        stock: 26,
        visualKey: 'tailoring_kit',
      },
      {
        id: 'demo-nanded-prod-20c',
        sku: 'ND-FTT-003',
        name: 'Pure Mercerized Cotton Saree Blouse Fabric Piece (1 metre)',
        priceInr: 180,
        unitLabel: '1 metre × 90 cm Woven Border Piece',
        description:
          'Breathable mercerized two-by-two rubia cotton blouse piece with traditional zari-style woven border. (Demo catalog item)',
        variants: ['Rani Pink', 'Bottle Green', 'Golden Mustard'],
        stock: 35,
        visualKey: 'blouse_fabric',
      },
    ],
  },

  // 21. Agriculture & Gardening
  {
    categoryId: 'cat-21-agriculture-gardening',
    categoryName: 'Agriculture & Gardening',
    artworkPreset: 'ceramic_pourover',
    storeA: {
      id: 'demo-nanded-store-21a',
      name: 'Krishi Seva & Home Garden Centre (Demo)',
      ownerName: 'Balaji Patil (Demo)',
      neighborhood: 'New Mondha',
      address: 'Demo Storefront, Krishi Market Road, New Mondha, Nanded',
      specialty: 'Gardening hand tools, vegetable seeds, organic manure & sprayers',
      operatingHours: '08:30 AM – 08:00 PM',
      avgDispatchMins: 32,
    },
    storeB: {
      id: 'demo-nanded-store-21b',
      name: 'HaritGodavari Nursery & Agro Supplies (Demo)',
      ownerName: 'Dattatray Shinde (Demo)',
      neighborhood: 'Kautha',
      address: 'Demo Storefront, Kautha Bridge Road, Nanded',
      specialty: 'Potting mix, cocopeat blocks, pruning shears & balcony planters',
      operatingHours: '08:00 AM – 07:30 PM',
      avgDispatchMins: 35,
    },
    products: [
      {
        id: 'demo-nanded-prod-21a',
        sku: 'ND-ANG-001',
        name: 'Gardening Tool Set',
        priceInr: 599,
        unitLabel: '5-Piece Heavy-Duty Garden Kit (Trowel, Weeder, Fork, Pruner, Gloves)',
        description:
          'Powder-coated rust-resistant carbon steel hand trowel, transplanter, cultivator rake, bypass pruning shear, and gripped gardening gloves for terrace and home gardens. (Demo catalog item)',
        variants: ['5-Piece Complete Set', '3-Piece Hand Tool Trio'],
        stock: 22,
        visualKey: 'gardening_tools',
      },
      {
        id: 'demo-nanded-prod-21b',
        sku: 'ND-ANG-002',
        name: 'Enriched Organic Vermicompost Manure for Plants, 5 kg',
        priceInr: 220,
        unitLabel: '5 kg Breathable Sack',
        description:
          '100% natural odor-free earthworm compost rich in humus and micronutrients for kitchen gardens, roses, and indoor pots. (Demo catalog item)',
        variants: ['5 kg Bag', '10 kg Bag'],
        stock: 35,
        visualKey: 'vermicompost',
      },
      {
        id: 'demo-nanded-prod-21c',
        sku: 'ND-ANG-003',
        name: '2-Litre Hand Pressure Garden Watering & Mist Sprayer',
        priceInr: 299,
        unitLabel: '2 Litre HDPE Bottle with Adjustable Brass Nozzle',
        description:
          'Easy-pump pneumatic sprayer with adjustable fine mist to jet brass nozzle for foliar watering and neem-oil spraying. (Demo catalog item)',
        variants: ['2 Litre Green & White'],
        stock: 28,
        visualKey: 'garden_sprayer',
      },
    ],
  },

  // 22. Household & Cleaning Supplies
  {
    categoryId: 'cat-22-household-cleaning-supplies',
    categoryName: 'Household & Cleaning Supplies',
    artworkPreset: 'hinoki_serum',
    storeA: {
      id: 'demo-nanded-store-22a',
      name: 'Swachh Home & Cleaning Needs (Demo)',
      ownerName: 'Santosh Gupta (Demo)',
      neighborhood: 'Anand Nagar',
      address: 'Demo Storefront, Anand Nagar Main Market, Nanded',
      specialty: 'Floor cleaners, laundry detergents, spin mops, brooms & tissue packs',
      operatingHours: '08:30 AM – 09:30 PM',
      avgDispatchMins: 24,
    },
    storeB: {
      id: 'demo-nanded-store-22b',
      name: 'Nanded Daily Hygiene & Utility Mart (Demo)',
      ownerName: 'Kavita Deshpande (Demo)',
      neighborhood: 'CIDCO Nanded',
      address: 'Demo Storefront, CIDCO Main Chowk, Nanded',
      specialty: 'Dishwash gels, scrub pads, dustbins & bathroom cleaning supplies',
      operatingHours: '09:00 AM – 09:00 PM',
      avgDispatchMins: 26,
    },
    products: [
      {
        id: 'demo-nanded-prod-22a',
        sku: 'ND-HCS-001',
        name: 'Floor Cleaning Liquid, 1 litre',
        priceInr: 149,
        unitLabel: '1 litre Concentrated Pine & Citrus Surface Cleaner',
        description:
          'Multi-surface disinfectant floor cleaning liquid that removes tough stains and leaves a fresh pine-citrus fragrance on marble, vitrified tiles, and granite. (Demo catalog item)',
        variants: ['Citrus Fresh (1 litre)', 'Pine Herbal (1 litre)', '2 × 1 litre Combo'],
        stock: 50,
        visualKey: 'floor_cleaner',
      },
      {
        id: 'demo-nanded-prod-22b',
        sku: 'ND-HCS-002',
        name: '360° Spin Mop Bucket Set with Stainless Steel Rod & 2 Refills',
        priceInr: 899,
        unitLabel: '1 Twin-Tub Bucket + Telescopic Handle + 2 Microfiber Heads',
        description:
          'Effortless wringer spin mop bucket with wheels, drainage spout, and super-absorbent microfiber mop heads. (Demo catalog item)',
        variants: ['Teal Blue Bucket', 'Slate Grey Bucket'],
        stock: 16,
        visualKey: 'spin_mop',
      },
      {
        id: 'demo-nanded-prod-22c',
        sku: 'ND-HCS-003',
        name: 'Concentrated Lemon Dishwash Gel (750 ml) + 3 Scrub Pads',
        priceInr: 135,
        unitLabel: '750 ml Bottle + 3 Scrubber Pads',
        description:
          'Grease-cutting lemon dishwashing liquid gentle on hands, paired with three non-scratch utensil scrub pads. (Demo catalog item)',
        variants: ['750 ml Combo'],
        stock: 42,
        visualKey: 'dishwash_gel',
      },
    ],
  },

  // 23. Handicrafts & Local Products
  {
    categoryId: 'cat-23-handicrafts-local-products',
    categoryName: 'Handicrafts & Local Products',
    artworkPreset: 'ceramic_pourover',
    storeA: {
      id: 'demo-nanded-store-23a',
      name: 'Marathwada Kala & Craft Kendra (Demo)',
      ownerName: 'Madhuri Kulkarni (Demo)',
      neighborhood: 'Kala Mandir',
      address: 'Demo Storefront, Cultural Hall Road, Kala Mandir, Nanded',
      specialty: 'Folk wall art, wooden crafts, terracotta pottery & handwoven baskets',
      operatingHours: '10:00 AM – 08:30 PM',
      avgDispatchMins: 32,
    },
    storeB: {
      id: 'demo-nanded-store-23b',
      name: 'Deccan Artisan Collective (Demo)',
      ownerName: 'ShrikantBhosale (Demo)',
      neighborhood: 'Vazirabad',
      address: 'Demo Storefront, Heritage Lane, Vazirabad, Nanded',
      specialty: 'Hand-painted home accents, brass crafts & regional artisan goods',
      operatingHours: '10:30 AM – 08:30 PM',
      avgDispatchMins: 35,
    },
    products: [
      {
        id: 'demo-nanded-prod-23a',
        sku: 'ND-HLP-001',
        name: 'Handmade Decorative Wall Art',
        priceInr: 799,
        unitLabel: '30 cm × 40 cm Framed Folk Motif Wall Plaque',
        description:
          'Hand-painted traditional Warli and geometric folk motif decorative wall art mounted in a seasoned teak-finish wooden frame with rear hanging hook. (Demo catalog item)',
        variants: ['Terracotta & Ivory Folk Frame', 'Indigo & Gold Motif Frame'],
        stock: 14,
        visualKey: 'handmade_wall_art',
      },
      {
        id: 'demo-nanded-prod-23b',
        sku: 'ND-HLP-002',
        name: 'Hand-Carved Sheesham Wood 7-Section Masala Dabba (Spice Box)',
        priceInr: 649,
        unitLabel: '22 cm Square Box with Glass Lid & Wooden Spoon',
        description:
          'Artisanal wooden spice organizer box with seven removable compartments and see-through glass top. (Demo catalog item)',
        variants: ['Natural Rosewood Finish'],
        stock: 18,
        visualKey: 'wooden_spice_box',
      },
      {
        id: 'demo-nanded-prod-23c',
        sku: 'ND-HLP-003',
        name: 'Natural Terracotta Clay Cooling Water Jug (1.5L) with Lid',
        priceInr: 420,
        unitLabel: '1.5 Litre Hand-Thrown Clay Carafe',
        description:
          'Unglazed river-clay table water pitcher that naturally cools drinking water with an earthy aroma. (Demo catalog item)',
        variants: ['1.5 Litre Jug', 'Jug + 2 Clay Tumblers'],
        stock: 20,
        visualKey: 'terracotta_jug',
      },
    ],
  },

  // 24. Party & Celebration Supplies
  {
    categoryId: 'cat-24-party-celebration-supplies',
    categoryName: 'Party & Celebration Supplies',
    artworkPreset: 'brass_lamp',
    storeA: {
      id: 'demo-nanded-store-24a',
      name: 'Nanded Celebration & Party House (Demo)',
      ownerName: 'Gaurav Soni (Demo)',
      neighborhood: 'Bhagya Nagar',
      address: 'Demo Storefront, Celebration Arcade, Bhagya Nagar, Nanded',
      specialty: 'Birthday banners, foil balloons, cake toppers, candles & streamers',
      operatingHours: '09:30 AM – 09:30 PM',
      avgDispatchMins: 24,
    },
    storeB: {
      id: 'demo-nanded-store-24b',
      name: 'Jashn Event & Festive Supplies (Demo)',
      ownerName: 'Snehal Patil (Demo)',
      neighborhood: 'Shivaji Nagar',
      address: 'Demo Storefront, Shivaji Nagar Market Lane, Nanded',
      specialty: 'Fairy lights, disposable party tableware, ribbons & gift bags',
      operatingHours: '10:00 AM – 09:30 PM',
      avgDispatchMins: 26,
    },
    products: [
      {
        id: 'demo-nanded-prod-24a',
        sku: 'ND-PCS-001',
        name: 'Birthday Decoration Kit',
        priceInr: 399,
        unitLabel: '45-Piece All-in-One Party Combo',
        description:
          'Complete home celebration kit containing metallic "Happy Birthday" cardstock banner, 35 pastel & gold balloons, 2 foil star balloons, shimmer curtain backdrop, balloon arch strip, and glue dots. (Demo catalog item)',
        variants: ['Gold, White & Black Theme', 'Pastel Pink & Rose Gold Theme', 'Blue & Silver Theme'],
        stock: 32,
        visualKey: 'birthday_decoration_kit',
      },
      {
        id: 'demo-nanded-prod-24b',
        sku: 'ND-PCS-002',
        name: 'Warm White Copper-Wire LED Fairy String Lights (10 metres)',
        priceInr: 249,
        unitLabel: '10 metre Plug-In String Light (100 Micro LEDs)',
        description:
          'Flexible waterproof copper-wire warm white LED string lights for birthday backdrops, balconies, and festive home decor. (Demo catalog item)',
        variants: ['Warm White', 'Golden Amber'],
        stock: 38,
        visualKey: 'fairy_lights',
      },
      {
        id: 'demo-nanded-prod-24c',
        sku: 'ND-PCS-003',
        name: 'Eco-Friendly Biodegradable Party Plates, Cups & Forks (20 Guests)',
        priceInr: 320,
        unitLabel: '60-Piece Compostable Tableware Pack',
        description:
          'Sturdy sugarcane bagasse plates, paper cups, and wooden forks for hassle-free home gatherings and birthday parties. (Demo catalog item)',
        variants: ['Pack for 20 Guests'],
        stock: 25,
        visualKey: 'party_tableware',
      },
    ],
  },

  // 25. Other Local Retail Stores
  {
    categoryId: 'cat-25-other-local-retail-stores',
    categoryName: 'Other Local Retail Stores',
    artworkPreset: 'leather_totebag',
    storeA: {
      id: 'demo-nanded-store-25a',
      name: 'Nanded General Variety & Utility Store (Demo)',
      ownerName: 'AshokRathi (Demo)',
      neighborhood: 'Vazirabad',
      address: 'Demo Storefront, Main Market Road, Vazirabad, Nanded',
      specialty: 'Storage organizers, travel accessories, umbrellas & daily utility goods',
      operatingHours: '09:30 AM – 09:30 PM',
      avgDispatchMins: 26,
    },
    storeB: {
      id: 'demo-nanded-store-25b',
      name: 'Sahara Multi-Utility & Home Convenience Shop (Demo)',
      ownerName: 'Farhan Siddiqui (Demo)',
      neighborhood: 'Taroda Naka',
      address: 'Demo Storefront, Taroda Naka Main Square, Nanded',
      specialty: 'Home storage boxes, garment racks, flasks & everyday essentials',
      operatingHours: '09:30 AM – 09:30 PM',
      avgDispatchMins: 28,
    },
    products: [
      {
        id: 'demo-nanded-prod-25a',
        sku: 'ND-OLR-001',
        name: 'Multipurpose Storage Organizer',
        priceInr: 299,
        unitLabel: 'Modular 4-Compartment Desktop & Wardrobe Basket',
        description:
          'Durable ventilated woven-texture polypropylene storage organizer bin with handles and divider sections for wardrobe shelves, kitchen counters, and study tables. (Demo catalog item)',
        variants: ['Warm Ivory (Large)', 'Slate Grey (Large)', 'Set of 2 Medium Bins'],
        stock: 36,
        visualKey: 'storage_organizer',
      },
      {
        id: 'demo-nanded-prod-25b',
        sku: 'ND-OLR-002',
        name: '3-Fold Windproof Automatic Open/Close Umbrella',
        priceInr: 380,
        unitLabel: 'Compact 8-Rib Pongee Canopy Umbrella',
        description:
          'All-season sun and monsoon folding umbrella with fiberglass ribs and one-button auto open/close grip. (Demo catalog item)',
        variants: ['Classic Black', 'Navy Blue'],
        stock: 28,
        visualKey: 'folding_umbrella',
      },
      {
        id: 'demo-nanded-prod-25c',
        sku: 'ND-OLR-003',
        name: 'Double-Wall Vacuum Insulated Stainless Steel Flask (750 ml)',
        priceInr: 549,
        unitLabel: '750 ml Hot & Cold Bottle (304 Grade Steel)',
        description:
          'Leak-proof insulated water bottle that keeps beverages hot or cold for up to 18 hours during work, travel, or college. (Demo catalog item)',
        variants: ['Brushed Steel', 'Matte Black'],
        stock: 24,
        visualKey: 'steel_flask',
      },
    ],
  },
];

const NANDED_COVERED_LOCALITIES = [
  'Vazirabad',
  'Shivaji Nagar',
  'Taroda Naka',
  'Bhagya Nagar',
  'Vishnupuri',
  'Anand Nagar',
  'Kala Mandir',
  'Srinagar',
  'CIDCO Nanded',
  'WorkShop Corner',
  'ITwara',
  'Kautha',
  'Hyderbagh',
  'New Mondha',
];

export const NANDED_DEMO_SELLERS: SellerProfile[] = [];
export const NANDED_DEMO_STORES: LocalStore[] = [];
export const NANDED_DEMO_PRODUCTS: Product[] = [];

for (let i = 0; i < NANDED_25_CATEGORY_BLUEPRINTS.length; i++) {
  const bp = NANDED_25_CATEGORY_BLUEPRINTS[i];
  const catNumber = String(i + 1).padStart(2, '0');
  const sellerIdA = `demo-nanded-seller-${catNumber}a`;
  const sellerIdB = `demo-nanded-seller-${catNumber}b`;

  NANDED_DEMO_SELLERS.push(
    {
      id: sellerIdA,
      businessOwnerName: bp.storeA.ownerName,
      phoneE164: `+91982301${catNumber}01`,
      phoneCountryCode: 'IN',
      phoneVerified: true,
      migrationRequired: false,
      role: 'SELLER',
      storeIds: [bp.storeA.id],
      isDemo: true,
      demoBatchId: NANDED_DEMO_BATCH_ID,
    },
    {
      id: sellerIdB,
      businessOwnerName: bp.storeB.ownerName,
      phoneE164: `+91982301${catNumber}02`,
      phoneCountryCode: 'IN',
      phoneVerified: true,
      migrationRequired: false,
      role: 'SELLER',
      storeIds: [bp.storeB.id],
      isDemo: true,
      demoBatchId: NANDED_DEMO_BATCH_ID,
    }
  );

  const storeCoverA = `/api/catalog-image?type=store&category=${encodeURIComponent(
    bp.categoryId
  )}&variant=a&title=${encodeURIComponent(bp.storeA.name)}`;
  const storeCoverB = `/api/catalog-image?type=store&category=${encodeURIComponent(
    bp.categoryId
  )}&variant=b&title=${encodeURIComponent(bp.storeB.name)}`;

  NANDED_DEMO_STORES.push(
    {
      id: bp.storeA.id,
      sellerId: sellerIdA,
      sellerName: bp.storeA.ownerName,
      name: bp.storeA.name,
      categoryId: bp.categoryId,
      category: bp.categoryName,
      description: `${bp.storeA.specialty}. Demo storefront in ${bp.storeA.neighborhood}, Nanded for URBANDIRECT platform testing.`,
      countryCode: 'IN',
      country: 'India',
      stateRegion: 'Maharashtra',
      district: 'Nanded',
      localityType: 'CITY',
      cityId: 'india-maharashtra-nanded',
      cityName: 'Nanded',
      postalCode: '431601',
      city: `Nanded · ${bp.storeA.neighborhood}`,
      neighborhood: bp.storeA.neighborhood,
      address: bp.storeA.address,
      locationVerified: true,
      locationSource: 'USER_PROVIDED',
      verificationStatus: 'USER_PROVIDED_UNVERIFIED',
      operatingHours: bp.storeA.operatingHours,
      avgDispatchMins: bp.storeA.avgDispatchMins,
      rating: 4.8,
      verifiedSince: 'Demo Store',
      specialty: bp.storeA.specialty,
      upiHandle: `demo.${catNumber}a@okaxis`,
      activeSkus: 2,
      isActive: true,
      currency: 'INR',
      coverImageUrl: storeCoverA,
      logoUrl: storeCoverA,
      isDemo: true,
      demoBatchId: NANDED_DEMO_BATCH_ID,
      createdAt: NANDED_DEMO_CREATED_AT,
      serviceArea: {
        scopeType: 'CITY_WIDE',
        coveredLocalities: NANDED_COVERED_LOCALITIES,
        maxRadiusKm: 12,
        sellerDeliveryFee: 0,
        freeDeliveryAbove: 199,
        fulfillmentNote:
          'Demo store delivery across Nanded city localities (Pay on delivery via UPI or Cash)',
      },
    },
    {
      id: bp.storeB.id,
      sellerId: sellerIdB,
      sellerName: bp.storeB.ownerName,
      name: bp.storeB.name,
      categoryId: bp.categoryId,
      category: bp.categoryName,
      description: `${bp.storeB.specialty}. Demo storefront in ${bp.storeB.neighborhood}, Nanded for URBANDIRECT platform testing.`,
      countryCode: 'IN',
      country: 'India',
      stateRegion: 'Maharashtra',
      district: 'Nanded',
      localityType: 'CITY',
      cityId: 'india-maharashtra-nanded',
      cityName: 'Nanded',
      postalCode: '431602',
      city: `Nanded · ${bp.storeB.neighborhood}`,
      neighborhood: bp.storeB.neighborhood,
      address: bp.storeB.address,
      locationVerified: true,
      locationSource: 'USER_PROVIDED',
      verificationStatus: 'USER_PROVIDED_UNVERIFIED',
      operatingHours: bp.storeB.operatingHours,
      avgDispatchMins: bp.storeB.avgDispatchMins,
      rating: 4.7,
      verifiedSince: 'Demo Store',
      specialty: bp.storeB.specialty,
      upiHandle: `demo.${catNumber}b@okicici`,
      activeSkus: 1,
      isActive: true,
      currency: 'INR',
      coverImageUrl: storeCoverB,
      logoUrl: storeCoverB,
      isDemo: true,
      demoBatchId: NANDED_DEMO_BATCH_ID,
      createdAt: NANDED_DEMO_CREATED_AT,
      serviceArea: {
        scopeType: 'CITY_WIDE',
        coveredLocalities: NANDED_COVERED_LOCALITIES,
        maxRadiusKm: 12,
        sellerDeliveryFee: 0,
        freeDeliveryAbove: 199,
        fulfillmentNote:
          'Demo store delivery across Nanded city localities (Pay on delivery via UPI or Cash)',
      },
    }
  );

  // Assign products 0 & 2 to Store A, and product 1 to Store B so every single store has products
  const [prod0, prod1, prod2] = bp.products;

  NANDED_DEMO_PRODUCTS.push(
    {
      id: prod0.id,
      sellerId: sellerIdA,
      storeId: bp.storeA.id,
      storeName: bp.storeA.name,
      sku: prod0.sku,
      name: prod0.name,
      categoryId: bp.categoryId,
      category: bp.categoryName,
      price: prod0.priceInr,
      currency: 'INR',
      unit: prod0.unitLabel,
      city: `Nanded · ${bp.storeA.neighborhood}`,
      neighborhood: bp.storeA.neighborhood,
      distanceKm: 1.2,
      deliveryMins: bp.storeA.avgDispatchMins,
      stock: prod0.stock,
      isAvailable: true,
      rating: 4.8,
      reviewsCount: 24,
      description: prod0.description,
      dimensions: prod0.unitLabel,
      materials: `${bp.categoryName} · Demo Specification`,
      variants: prod0.variants,
      statusNote: 'In stock',
      artworkPreset: bp.artworkPreset,
      customImageUrl: `/api/catalog-image?type=product&key=${encodeURIComponent(
        prod0.visualKey
      )}&category=${encodeURIComponent(bp.categoryId)}&title=${encodeURIComponent(
        prod0.name
      )}&unit=${encodeURIComponent(prod0.unitLabel)}`,
      isDemo: true,
      demoBatchId: NANDED_DEMO_BATCH_ID,
      createdAt: NANDED_DEMO_CREATED_AT,
    },
    {
      id: prod1.id,
      sellerId: sellerIdB,
      storeId: bp.storeB.id,
      storeName: bp.storeB.name,
      sku: prod1.sku,
      name: prod1.name,
      categoryId: bp.categoryId,
      category: bp.categoryName,
      price: prod1.priceInr,
      currency: 'INR',
      unit: prod1.unitLabel,
      city: `Nanded · ${bp.storeB.neighborhood}`,
      neighborhood: bp.storeB.neighborhood,
      distanceKm: 1.5,
      deliveryMins: bp.storeB.avgDispatchMins,
      stock: prod1.stock,
      isAvailable: true,
      rating: 4.7,
      reviewsCount: 18,
      description: prod1.description,
      dimensions: prod1.unitLabel,
      materials: `${bp.categoryName} · Demo Specification`,
      variants: prod1.variants,
      stockNote: 'Demo stock',
      statusNote: 'In stock',
      artworkPreset: bp.artworkPreset,
      customImageUrl: `/api/catalog-image?type=product&key=${encodeURIComponent(
        prod1.visualKey
      )}&category=${encodeURIComponent(bp.categoryId)}&title=${encodeURIComponent(
        prod1.name
      )}&unit=${encodeURIComponent(prod1.unitLabel)}`,
      isDemo: true,
      demoBatchId: NANDED_DEMO_BATCH_ID,
      createdAt: NANDED_DEMO_CREATED_AT,
    },
    {
      id: prod2.id,
      sellerId: sellerIdA,
      storeId: bp.storeA.id,
      storeName: bp.storeA.name,
      sku: prod2.sku,
      name: prod2.name,
      categoryId: bp.categoryId,
      category: bp.categoryName,
      price: prod2.priceInr,
      currency: 'INR',
      unit: prod2.unitLabel,
      city: `Nanded · ${bp.storeA.neighborhood}`,
      neighborhood: bp.storeA.neighborhood,
      distanceKm: 1.3,
      deliveryMins: bp.storeA.avgDispatchMins,
      stock: prod2.stock,
      isAvailable: true,
      rating: 4.8,
      reviewsCount: 15,
      description: prod2.description,
      dimensions: prod2.unitLabel,
      materials: `${bp.categoryName} · Demo Specification`,
      variants: prod2.variants,
      statusNote: 'In stock',
      artworkPreset: bp.artworkPreset,
      customImageUrl: `/api/catalog-image?type=product&key=${encodeURIComponent(
        prod2.visualKey
      )}&category=${encodeURIComponent(bp.categoryId)}&title=${encodeURIComponent(
        prod2.name
      )}&unit=${encodeURIComponent(prod2.unitLabel)}`,
      isDemo: true,
      demoBatchId: NANDED_DEMO_BATCH_ID,
      createdAt: NANDED_DEMO_CREATED_AT,
    }
  );
}

// Sanity check helper for verification reports
export function getNandedDemoDatasetSummary() {
  const categoryIdsWithStores = new Set(
    NANDED_DEMO_STORES.map((s) => s.categoryId)
  );
  const categoryIdsWithProducts = new Set(
    NANDED_DEMO_PRODUCTS.map((p) => p.categoryId)
  );
  return {
    batchId: NANDED_DEMO_BATCH_ID,
    totalCategoriesCoveredByStores: categoryIdsWithStores.size,
    totalCategoriesCoveredByProducts: categoryIdsWithProducts.size,
    all25CategoriesCovered:
      categoryIdsWithStores.size === 25 &&
      categoryIdsWithProducts.size === 25,
    totalDemoStores: NANDED_DEMO_STORES.length,
    totalDemoProducts: NANDED_DEMO_PRODUCTS.length,
    totalDemoSellers: NANDED_DEMO_SELLERS.length,
  };
}
