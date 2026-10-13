// ─── TikTok Shop product lookup (shared with Products page import) ───
// Used by Ask Take24 to add products. Needs WORKER (ask.html).
const SCOUT_WORKER_URL = typeof WORKER !== 'undefined' ? WORKER : 'https://take24-scout.kortnycall5.workers.dev';
function normalizeImportPrice(value) {
  if(value == null) return '';
  if(typeof value === 'number') return value ? `$${value}` : '';
  if(typeof value === 'string') return value.trim();
  const raw = String(value.real_price || value.price || value.sale_price || value.sale_price_format || value.sale_price_decimal || value.single_product_price_format || value.original_price || value.origin_price_format || value.min_price || '').trim();
  if(!raw) return '';
  const symbol = String(value.currency_symbol || '').trim();
  return symbol && !raw.startsWith(symbol) ? `${symbol}${raw}` : raw;
}
function importImageUrlFrom(value) {
  if(!value) return '';
  if(typeof value === 'string') return /^https?:\/\//i.test(value.trim()) ? value.trim() : '';
  if(Array.isArray(value)) {
    for(const item of value) {
      const found = importImageUrlFrom(item);
      if(found) return found;
    }
    return '';
  }
  if(typeof value === 'object') {
    const directKeys = ['url','src','uri','display_url','image_url','cover_url','thumbnail_url','thumb_url','large_url','medium_url','small_url','origin_url','original_url'];
    for(const key of directKeys) {
      const found = importImageUrlFrom(value[key]);
      if(found) return found;
    }
    const nestedKeys = ['url_list','urls','images','image_urls','cover','image','thumbnail','thumb','main_image','product_image','product_images'];
    for(const key of nestedKeys) {
      const found = importImageUrlFrom(value[key]);
      if(found) return found;
    }
  }
  return '';
}
function normalizeImportImage(product) {
  const candidates = [
    product.cover,
    product.cover_url,
    product.image,
    product.thumbnail,
    product.thumb,
    product.thumb_url,
    product.thumbnail_url,
    product.image_url,
    product.images_url,
    product.image_urls,
    product.product_image,
    product.product_image_url,
    product.main_image,
    product.main_image_url,
    product.media,
    product.product?.image,
    product.product?.cover,
    product.product?.images,
    product.images?.[0],
    product.product_images?.[0]
  ];
  for(const candidate of candidates) {
    const found = importImageUrlFrom(candidate);
    if(found) return found;
  }
  return importImageUrlFrom(product);
}
function importTextFrom(value, keys=[]) {
  if(value == null) return '';
  if(typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if(Array.isArray(value)) {
    for(const item of value) {
      const found = importTextFrom(item, keys);
      if(found) return found;
    }
    return '';
  }
  if(typeof value === 'object') {
    for(const key of keys) {
      const found = importTextFrom(value[key], keys);
      if(found) return found;
    }
  }
  return '';
}
function deepImportTextFrom(value, keys=[], depth=5) {
  if(value == null || depth < 0) return '';
  if(typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if(Array.isArray(value)) {
    for(const item of value) {
      const found = deepImportTextFrom(item, keys, depth - 1);
      if(found) return found;
    }
    return '';
  }
  if(typeof value === 'object') {
    for(const key of keys) {
      const found = importTextFrom(value[key], keys);
      if(found) return found;
    }
    for(const item of Object.values(value)) {
      const found = deepImportTextFrom(item, keys, depth - 1);
      if(found) return found;
    }
  }
  return '';
}
function normalizeImportShopName(product) {
  return importTextFrom(product, [
    'brand',
    'brand_name',
    'shop_name',
    'shopName',
    'seller_name',
    'sellerName',
    'store_name',
    'storeName',
    'author_name',
    'creator_name'
  ]) || importTextFrom(product.seller_info, ['shop_name','seller_name','name','title']) || importTextFrom(product.sellerInfo, ['shop_name','shopName','seller_name','sellerName','name','title']) || importTextFrom(product.shop, ['name','shop_name','shopName','title']) || importTextFrom(product.seller, ['name','shop_name','shopName','seller_name','sellerName','title']) || importTextFrom(product.store, ['name','store_name','storeName','title']) || deepImportTextFrom(product, ['shop_name','shopName','seller_name','sellerName','store_name','storeName']);
}
function cleanImportUrl(value) {
  const text = String(value || '').trim();
  if(!text) return '';
  if(/^https?:\/\//i.test(text)) return text;
  if(/^www\./i.test(text)) return `https://${text}`;
  return '';
}
function normalizeImportLink(product) {
  const directLink = cleanImportUrl(importTextFrom(product, [
    'url',
    'product_url',
    'productUrl',
    'product_detail_url',
    'productDetailUrl',
    'share_url',
    'shareUrl',
    'link',
    'detail_url',
    'detailUrl',
    'web_url',
    'webUrl',
    'pdp_url',
    'pdpUrl'
  ]) || importTextFrom(product.seo_url, ['canonical_url','canonicalUrl','url','link']) || importTextFrom(product.seoUrl, ['canonical_url','canonicalUrl','url','link']) || importTextFrom(product.share_info, ['share_url','shareUrl','url','link']) || importTextFrom(product.shareInfo, ['share_url','shareUrl','url','link']) || importTextFrom(product.product, ['url','product_url','productUrl','share_url','shareUrl','detail_url','detailUrl','link']) || deepImportTextFrom(product, ['canonical_url','canonicalUrl','product_url','productUrl','pdp_url','pdpUrl','share_url','shareUrl']));
  if(directLink) return directLink;
  const slug = importTextFrom(product.seo_url, ['slug']) || importTextFrom(product.seoUrl, ['slug']) || deepImportTextFrom(product, ['slug']);
  const productId = importTextFrom(product, ['product_id','productId','id']) || deepImportTextFrom(product, ['product_id','productId']);
  const fallbackSlug = slug || String(product.title || product.name || product.product_name || product.product_title || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return fallbackSlug && productId ? `https://www.tiktok.com/shop/pdp/${encodeURIComponent(fallbackSlug)}/${encodeURIComponent(productId)}` : '';
}
function normalizeImportProduct(product) {
  const price = normalizeImportPrice(product.price || product.sale_price || product.original_price || product.price_info || product.product_price_info);
  const sold = Number(product.sold_count || product.sales_count || product.total_sold || product.units_sold || product.sold_info?.sold_count || 0) || 0;
  const productId = importTextFrom(product, ['product_id','productId','id']) || deepImportTextFrom(product, ['product_id','productId']);
  return {
    name: String(product.title || product.name || product.product_name || product.product_title || '').trim(),
    brand: normalizeImportShopName(product),
    price,
    sold,
    link: normalizeImportLink(product),
    image_url: normalizeImportImage(product),
    product_id: productId,
    _raw: product
  };
}
async function enrichImportProduct(product, key) {
  if(!product?.link) return product;
  try {
    const detailUrl = `${SCOUT_WORKER_URL}?endpoint=tiktok/product&url=${encodeURIComponent(product.link)}&region=US`;
    const res = await fetch(detailUrl);
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch(parseErr) { return product; }
    if(!res.ok) return product;
    const detailRaw = data?.product || data?.data?.product || data?.data || data?.result || data;
    const detail = normalizeImportProduct(detailRaw);
    return {
      ...product,
      name: detail.name || product.name,
      brand: detail.brand || product.brand,
      price: detail.price || product.price,
      sold: detail.sold || product.sold,
      link: detail.link || product.link,
      image_url: detail.image_url || product.image_url
    };
  } catch(err) {
    return product;
  }
}
async function shopSearch(query){
  const r=await fetch(`${SCOUT_WORKER_URL}?endpoint=tiktok/shop/search&query=${encodeURIComponent(query)}&region=US`,{signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined});
  const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data?.message||data?.error||`Search error ${r.status}`);
  const raw=data?.products||data?.data?.products||data?.data||data?.results||data?.items||[];
  return (Array.isArray(raw)?raw:[]).map(normalizeImportProduct).filter(p=>p.name).slice(0,6);
}
async function shopFromLink(link){
  const p=await enrichImportProduct({link,name:'',brand:'',price:'',sold:0,image_url:''});
  return p&&p.name?p:null;
}
