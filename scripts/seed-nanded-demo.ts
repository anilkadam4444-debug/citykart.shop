import {
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  fetchStoresAndProductsFromFirestore,
  seedNandedDemoCatalogToFirestore,
} from '../lib/firebase';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  CustomerShoppingLocation,
  formatCurrency,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
  queryCityScopedCatalog,
} from '../lib/catalog-data';
import {getNandedDemoDatasetSummary} from '../lib/nanded-demo-data';

async function main() {
  console.log('==========================================================');
  console.log('URBANDIRECT — NANDED 25-CATEGORY DEMO SEEDER & VERIFIER');
  console.log(`Firebase Project ID: ${FIREBASE_PROJECT_ID}`);
  console.log(`Firestore Database:  ${FIRESTORE_DATABASE_ID}`);
  console.log('==========================================================');

  const summary = getNandedDemoDatasetSummary();
  console.log('Dataset Summary:', JSON.stringify(summary, null, 2));

  console.log('\n1. Seeding Nanded demo stores and products into Firestore...');
  const seedResult = await seedNandedDemoCatalogToFirestore();
  console.log('Seed Result:', JSON.stringify(seedResult, null, 2));

  console.log('\n2. Verifying records read back from Firestore...');
  const live = await fetchStoresAndProductsFromFirestore();
  const nandedFirestoreStores = live.stores.filter(
    (s) => s.isDemo && s.demoBatchId === summary.batchId
  );
  const nandedFirestoreProducts = live.products.filter(
    (p) => p.isDemo && p.demoBatchId === summary.batchId
  );
  console.log(
    `Firestore Verified Counts -> Demo Stores: ${nandedFirestoreStores.length}, Demo Products: ${nandedFirestoreProducts.length}`
  );

  console.log('\n3. Running City & Category Filter Verification Tests...');
  const nandedLoc: CustomerShoppingLocation = {
    mode: 'SELECTED_LOCATION',
    country: 'India',
    countryCode: 'IN',
    stateRegion: 'Maharashtra',
    city: 'Nanded',
    cityId: 'india-maharashtra-nanded',
    locality: 'Vazirabad',
  };

  const nandedAllResult = queryCityScopedCatalog({
    stores: INITIAL_STORES,
    products: INITIAL_PRODUCTS,
    customerLocation: nandedLoc,
    selectedCategory: 'All Categories',
    searchQuery: '',
    onlyDeliverableToLocality: false,
  });

  console.log(
    `Test A (Nanded All Categories): ${nandedAllResult.eligibleStoresInCity.length} stores, ${nandedAllResult.filteredProducts.length} products`
  );

  let categoriesPassing = 0;
  for (const cat of AUTHORITATIVE_STORE_CATEGORIES) {
    const catRes = queryCityScopedCatalog({
      stores: INITIAL_STORES,
      products: INITIAL_PRODUCTS,
      customerLocation: nandedLoc,
      selectedCategory: cat.name,
      searchQuery: '',
      onlyDeliverableToLocality: false,
    });
    if (catRes.filteredStores.length >= 2 && catRes.filteredProducts.length >= 3) {
      categoriesPassing++;
    } else {
      console.error(
        `Category failed minimum check: ${cat.name} (stores=${catRes.filteredStores.length}, products=${catRes.filteredProducts.length})`
      );
    }
  }
  console.log(
    `Test B (Category Coverage in Nanded): ${categoriesPassing}/25 categories have >= 2 stores and >= 3 products`
  );

  const puneLoc: CustomerShoppingLocation = {
    mode: 'SELECTED_LOCATION',
    country: 'India',
    countryCode: 'IN',
    stateRegion: 'Maharashtra',
    city: 'Pune',
    cityId: 'india-maharashtra-pune',
    locality: 'Kothrud',
  };
  const puneResult = queryCityScopedCatalog({
    stores: INITIAL_STORES,
    products: INITIAL_PRODUCTS,
    customerLocation: puneLoc,
    selectedCategory: 'All Categories',
    searchQuery: '',
    onlyDeliverableToLocality: false,
  });
  const leakedNandedStoresInPune = puneResult.eligibleStoresInCity.filter(
    (s) => s.cityId === 'india-maharashtra-nanded'
  );
  console.log(
    `Test C (City Isolation - Pune selected): ${puneResult.eligibleStoresInCity.length} Pune stores, ${leakedNandedStoresInPune.length} Nanded stores leaked`
  );

  console.log(
    `Test D (INR Price Formatting): 120 -> ${formatCurrency(120, 'INR')}, 799 -> ${formatCurrency(799, 'INR')}, 4999 -> ${formatCurrency(4999, 'INR')}`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
