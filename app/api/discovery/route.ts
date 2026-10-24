import {NextRequest, NextResponse} from 'next/server';
import {
  CustomerShoppingLocation,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
  normalizeCityId,
  ProductCategory,
  queryCityScopedCatalog,
} from '@/lib/catalog-data';

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const city = (searchParams.get('city') || '').trim();
  const stateRegion = (searchParams.get('stateRegion') || '').trim();
  const country = (searchParams.get('country') || '').trim();
  const cityId = (searchParams.get('cityId') || '').trim();
  const locality = (searchParams.get('locality') || '').trim();
  const category = (searchParams.get('category') ||
    'All Categories') as ProductCategory;
  const searchQuery = (searchParams.get('q') || '').trim();
  const onlyDeliverableToLocality =
    searchParams.get('onlyDeliverable') === 'true';

  const customerLocation: CustomerShoppingLocation = city
    ? {
        mode: 'SELECTED_LOCATION',
        country,
        stateRegion,
        city,
        cityId: cityId || normalizeCityId(country, stateRegion, city),
        locality,
      }
    : {
        mode: 'UNSET',
        country: '',
        stateRegion: '',
        city: '',
        locality: '',
      };

  const result = queryCityScopedCatalog({
    stores: INITIAL_STORES,
    products: INITIAL_PRODUCTS,
    customerLocation,
    selectedCategory: category,
    searchQuery,
    onlyDeliverableToLocality,
  });

  return NextResponse.json({
    customerLocation,
    requiresCitySelection: result.requiresCitySelection,
    stores: result.filteredStores,
    products: result.filteredProducts,
    totalEligibleStoresInCity: result.eligibleStoresInCity.length,
    categoryStoreCounts: result.categoryStoreCounts,
    categoryProductCounts: result.categoryProductCounts,
  });
}
