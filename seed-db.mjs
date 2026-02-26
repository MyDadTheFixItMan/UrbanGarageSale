import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCmAD0m-2Z_-WomxpDvREimaPSp2CtjmEY",
  authDomain: "urbangaragesale.firebaseapp.com",
  projectId: "urbangaragesale",
  storageBucket: "urbangaragesale.firebasestorage.app",
  messagingSenderId: "264749197802",
  appId: "1:264749197802:web:f09553f241658137af6a93",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const sampleListings = [
  {
    title: 'Vintage Furniture & Decor',
    description: 'Beautiful vintage furniture, lamps, and home decor items. Great condition!',
    address: '123 Chapel Street',
    suburb: 'Prahran',
    postcode: '3181',
    state: 'VIC',
    latitude: -37.8606,
    longitude: 145.0039,
    start_date: '2026-02-08',
    end_date: '2026-02-08',
    start_time: '09:00',
    end_time: '15:00',
    sale_type: 'garage_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_1',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Electronics & Books',
    description: 'Used electronics, textbooks, and paperbacks. All working perfectly.',
    address: '456 Fitzroy Street',
    suburb: 'Fitzroy',
    postcode: '3065',
    state: 'VIC',
    latitude: -37.8019,
    longitude: 144.9766,
    start_date: '2026-02-07',
    end_date: '2026-02-08',
    start_time: '08:00',
    end_time: '14:00',
    sale_type: 'garage_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_2',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Moving Sale - Everything Must Go',
    description: 'Complete household items. Owner relocating interstate.',
    address: '789 Toorak Road',
    suburb: 'South Yarra',
    postcode: '3141',
    state: 'VIC',
    latitude: -37.8468,
    longitude: 145.0164,
    start_date: '2026-02-14',
    end_date: '2026-02-15',
    start_time: '09:00',
    end_time: '16:00',
    sale_type: 'moving_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_3',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Garden Tools & Outdoor Gear',
    description: 'Lawnmowers, gardening tools, outdoor furniture and BBQ equipment.',
    address: '321 Commercial Road',
    suburb: 'Melbourne',
    postcode: '3000',
    state: 'VIC',
    latitude: -37.8136,
    longitude: 144.9631,
    start_date: '2026-02-09',
    end_date: '2026-02-09',
    start_time: '10:00',
    end_time: '14:00',
    sale_type: 'garage_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_4',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Kids Toys & Baby Equipment',
    description: 'Children\'s toys, stroller, crib, and kids clothing. Gently used.',
    address: '654 Southbank Boulevard',
    suburb: 'Southbank',
    postcode: '3006',
    state: 'VIC',
    latitude: -37.8267,
    longitude: 144.9769,
    start_date: '2026-02-10',
    end_date: '2026-02-10',
    start_time: '09:00',
    end_time: '13:00',
    sale_type: 'garage_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_5',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Clothing & Fashion Items',
    description: 'Designer clothes, shoes, handbags and accessories. Various sizes.',
    address: '987 Queen Street',
    suburb: 'Melbourne',
    postcode: '3000',
    state: 'VIC',
    latitude: -37.8129,
    longitude: 144.9701,
    start_date: '2026-02-11',
    end_date: '2026-02-11',
    start_time: '10:00',
    end_time: '15:00',
    sale_type: 'garage_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_6',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Estate Sale - Antiques & Collectibles',
    description: 'Antique furniture, china, jewelry and rare collectible items.',
    address: '111 Domain Road',
    suburb: 'South Yarra',
    postcode: '3141',
    state: 'VIC',
    latitude: -37.8394,
    longitude: 144.9852,
    start_date: '2026-02-15',
    end_date: '2026-02-16',
    start_time: '10:00',
    end_time: '17:00',
    sale_type: 'estate_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_7',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Kitchen & Dining Equipment',
    description: 'Pots, pans, dishes, cutlery, kitchen appliances and dining furniture.',
    address: '222 Brunswick Street',
    suburb: 'Fitzroy',
    postcode: '3065',
    state: 'VIC',
    latitude: -37.8006,
    longitude: 144.9814,
    start_date: '2026-02-12',
    end_date: '2026-02-12',
    start_time: '09:00',
    end_time: '14:00',
    sale_type: 'garage_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_8',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Sports & Fitness Equipment',
    description: 'Exercise bikes, dumbbells, yoga mats, sports equipment and gear.',
    address: '333 Swanston Street',
    suburb: 'Melbourne',
    postcode: '3000',
    state: 'VIC',
    latitude: -37.8102,
    longitude: 144.9658,
    start_date: '2026-02-13',
    end_date: '2026-02-13',
    start_time: '10:00',
    end_time: '13:00',
    sale_type: 'garage_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_9',
    status: 'active',
    payment_status: 'pending'
  },
  {
    title: 'Yard Sale - Everything Goes',
    description: 'Mixed household items, furniture, and miscellaneous goods.',
    address: '444 Lonsdale Street',
    suburb: 'Melbourne',
    postcode: '3000',
    state: 'VIC',
    latitude: -37.8141,
    longitude: 144.9609,
    start_date: '2026-02-16',
    end_date: '2026-02-16',
    start_time: '08:00',
    end_time: '12:00',
    sale_type: 'yard_sale',
    photos: [],
    created_by: 'seller@example.com',
    user_id: 'demo_user_10',
    status: 'active',
    payment_status: 'pending'
  }
];

async function seedDatabase() {
  try {
    console.log('Starting to seed database with sample listings...');
    let count = 0;
    
    for (const listing of sampleListings) {
      const garageSalesRef = collection(db, 'garageSales');
      await addDoc(garageSalesRef, {
        ...listing,
        created_at: new Date(),
      });
      count++;
      console.log(`✅ Added listing ${count}: ${listing.title}`);
    }
    
    console.log(`\n🎉 Successfully added ${count} sample listings to Firestore!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
