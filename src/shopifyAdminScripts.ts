/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */

import axios from 'axios';
import { backOff } from 'exponential-backoff';
import { getChannelInfo } from './shopifyScripts';
import { ShopifyOrderObject } from './types/shopify';
// import { cleansedAddress } from '../consumers/remorsePeriodProcessing/useCases/addressValidation/cleanAddress';

const {
  // TAG_BAD_ADDRESS_REPLACED,
  US_TAG_BAD_ADDRESS_NOT_AUTO_FIXABLE,
  US_TAG_DO_NOT_PROCESS,
  US_SHOPIFY_API_KEY,
  US_SHOPIFY_GRAPHQL_URL,
  US_STORE_HANDLE,
  // TAG_BAD_ADDRESS_REPLACED,
  EU_TAG_BAD_ADDRESS_NOT_AUTO_FIXABLE,
  EU_TAG_DO_NOT_PROCESS,
  EU_SHOPIFY_API_KEY,
  EU_SHOPIFY_GRAPHQL_URL,
  EU_STORE_HANDLE,
} = process.env;

let prefix: string;

export const isShippingRequired = (shopifyOrder: ShopifyOrderObject) => {
  const { line_items: lineItems } = shopifyOrder;
  for (const { requires_shipping: requiresShipping } of lineItems) {
    if (requiresShipping) {
      return true;
    }
  }
  return false;
};

export const isShopPayOrder = async (shopifyOrder: ShopifyOrderObject): Promise<boolean> => {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { data: { handle: channelHandle } } = await getChannelInfo(shopifyOrder.id);
    return channelHandle === 'shop';
  } catch (err: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.debug('isShopPayOrder, err:', err.stack);
    return false;
  }
};

export const isWebStoreOrder = async (shopifyOrder: ShopifyOrderObject): Promise<boolean> => {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { data: { handle: channelHandle } } = await getChannelInfo(shopifyOrder.id);
    return channelHandle === 'web';
  } catch (err: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.debug('isWebStoreOrder, err:', err.stack);
    return false;
  }
};

export const isSpecificChannelOrder = async (
  shopifyOrder: ShopifyOrderObject,
  channelHandles: string[],
): Promise<boolean> => {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { data: { handle: channelHandle } } = await getChannelInfo(shopifyOrder.id);
    console.debug('isSpecificChannelOrder debug:', { orderId: shopifyOrder.id, channelHandle: channelHandle as string });
    return channelHandles.includes(channelHandle as string);
  } catch (err: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.debug('isSpecificChannelOrder, err:', err.stack);
    return false;
  }
};

// export const updateAddressAndAddCorrespondingTag = async (
//   shopifyOrder: ShopifyOrderObject,
//   cleanedAddress: cleansedAddress,
// ) => {
//   const { shipping_address: shopifyAddress } = shopifyOrder;
//   shopifyAddress.address1 = cleanedAddress.address1;
//   shopifyAddress.address2 = cleanedAddress.address2;
//   shopifyAddress.city = cleanedAddress.city;
//   shopifyAddress.province_code = cleanedAddress.provinceCode;
//   shopifyAddress.zip = cleanedAddress.zip;
//   shopifyAddress.country_code = cleanedAddress.countryCode;
//   return Promise.all([
//     addTagsInShopifyAdmin(
//       shopifyOrder.admin_graphql_api_id,
//       [TAG_BAD_ADDRESS_REPLACED as string],
//     ),
//     updateShippingAddressInShopify(shopifyOrder),
//   ]);
// };

export const addBadAddressTags = async (
  shopifyOrder: ShopifyOrderObject,
) => {
  prefix = shopifyOrder.name.toLowerCase().includes('uk') ? 'EU_' : 'US_';
  const tagsToAdd: string[] = [];
  /**
   * @todo add back DO_NOT_PROCESS tagging for very bad addresses,
   * once have the OK from CX to proceed here (on next deploy).
   */
  tagsToAdd.push(process.env[`${prefix}TAG_BAD_ADDRESS_NOT_AUTO_FIXABLE`] as string);

  /**
   * @description holding off on freezing EU orders, awaiting phase 2 front-end
   * Loqate layer, as Loqate isn't very reliable for scoring international addresses,
   * when compared to US addresses
   */
  if (process.env[`${prefix}STORE_HANDLE`] !== 'EU') {
    tagsToAdd.push(process.env[`${prefix}TAG_DO_NOT_PROCESS`] as string);
  }

  return Promise.all([
    addTagsInShopifyAdmin(
      shopifyOrder.admin_graphql_api_id,
      tagsToAdd,
    ),
  ]);
};

export const updateShippingAddressInShopify = async (shopifyOrder: ShopifyOrderObject) => backOff(
  // eslint-disable-next-line no-return-await
  async () => await updateShippingAddressInShopifyWithoutRetry(shopifyOrder),
  {
    jitter: 'full',
    retry: (err, attemptNumber) => {
      console.error('updateShippingAddressInShopify, retry, error:', err);
      console.error('updateShippingAddressInShopify, retry, attemptNumber:', attemptNumber);
      return true; // keep retrying until (default) numAttempts
    },
  },
);

const updateShippingAddressInShopifyWithoutRetry = async (shopifyOrder: ShopifyOrderObject) => {
  prefix = shopifyOrder.name.toLowerCase().includes('uk') ? 'EU_' : 'US_';
  const data = JSON.stringify({
    query: `mutation orderUpdate($input: OrderInput!) {
                orderUpdate(input: $input) {
                  userErrors {
                    field
                    message
                  }
                }
              }`,
    variables: {
      input: {
        id: Buffer.from(`gid://shopify/Order/${shopifyOrder.id}`).toString('base64'),
        shippingAddress: {
          address1: shopifyOrder.shipping_address.address1,
          address2: shopifyOrder.shipping_address.address2,
          city: shopifyOrder.shipping_address.city,
          provinceCode: shopifyOrder.shipping_address.province_code,
          zip: shopifyOrder.shipping_address.zip,
          countryCode: shopifyOrder.shipping_address.country_code,
        },
      },
    },
  });

  const resp = await axios(
    {
      method: 'post',
      url: US_SHOPIFY_GRAPHQL_URL as string, // 'https://drsquatchsoapco-dev.myshopify.com/admin/api/2022-04/graphql.json',
      headers: {
        'X-Shopify-Access-Token': US_SHOPIFY_API_KEY as string,
        'Content-Type': 'application/json',
      },
      data,
    },
  );
  const { data: respData } = resp;

  if (respData.errors && Array.isArray(respData.errors) && respData.errors.length > 0) {
    console.error('respData.errors:', JSON.stringify(respData.errors));
    throw new Error(respData.errors[0].message);
  }
  if (
    respData.data && respData.data.userErrors
    && Array.isArray(respData.data.userErrors)
    && respData.data.userErrors.length > 0
  ) {
    console.error('respData.data.userErrors:', JSON.stringify(respData.data.userErrors));
    throw new Error(respData.data.userErrors[0].message);
  }
};

export const tagCustomerInShopify = async (
  shopifyOrder: ShopifyOrderObject,
  tags: string[],
) => addTagsInShopifyAdmin(
  shopifyOrder.customer.admin_graphql_api_id,
  tags,
);

/**
 * @example `de-customer` or `us-customer` tags will be added...
 * Interesting edge case would be a customer that orders for multiple countries...
 * But, 80-20 rule, bro! In terms of time + resources + ROI of pursuing that...
 * I think customers that do weird stuff like that should maybe expect weird behavior, anyways.
 */
export const addCountryTagToCustomerInShopify = async (shopifyOrder: ShopifyOrderObject) => {
  const customerCountryTag = `${shopifyOrder.shipping_address.country_code.toLowerCase()}-customer`;
  return addTagsInShopifyAdmin(
    shopifyOrder.customer.admin_graphql_api_id,
    [customerCountryTag],
  );
};

export const getCustomerOrderCount = async (shopifyOrder: ShopifyOrderObject) => backOff(
  // eslint-disable-next-line no-return-await
  async () => await getCustomerOrderCountWithoutRetry(shopifyOrder),
  {
    jitter: 'full',
    retry: (err, attemptNumber) => {
      console.error('getCustomerOrderCount, retry, error:', err);
      console.error('getCustomerOrderCount, retry, attemptNumber:', attemptNumber);
      return true; // keep retrying until (default) numAttempts
    },
  },
);

const getCustomerOrderCountWithoutRetry = async (
  shopifyOrder: ShopifyOrderObject,
): Promise<number> => {
  prefix = shopifyOrder.name.toLowerCase().includes('uk') ? 'EU_' : 'US_';

  const data = JSON.stringify({
    query: `{ query: customer(id: "gid://shopify/Customer/${shopifyOrder.customer.id}") {
        numberOfOrders
      }
    }`,
  });

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const resp = await axios(
    {
      method: 'post',
      url: US_SHOPIFY_GRAPHQL_URL, // 'https://drsquatchsoapco-dev.myshopify.com/admin/api/2022-04/graphql.json',
      headers: {
        'X-Shopify-Access-Token': US_SHOPIFY_API_KEY,
        'Content-Type': 'application/json',
      },
      data,
    },
  );
  const { data: respData } = resp;

  if (respData.errors && Array.isArray(respData.errors) && respData.errors.length > 0) {
    console.error('respData.errors:', JSON.stringify(respData.errors));
    throw new Error(respData.errors[0].message);
  }
  if (
    respData.data && respData.data.userErrors
    && Array.isArray(respData.data.userErrors)
    && respData.data.userErrors.length > 0
  ) {
    console.error('respData.data.userErrors:', JSON.stringify(respData.data.userErrors));
    throw new Error(respData.data.userErrors[0].message);
  }

  return Number(respData.data.query.numberOfOrders);
};

const addTagWithoutRetry = async (
  gid: string,
  tags: string[],
): Promise<void> => {
  if (gid.indexOf('gid://') !== 0) {
    throw new Error(`gid (${gid}) doesn't appear to be a valid gid!`);
  }
  const data = JSON.stringify({
    query: `mutation tagsAdd($id: ID!, $tags: [String!]!) {
                tagsAdd(id: $id, tags: $tags) {
                  userErrors {
                    field
                    message
                  }
                }
              }`,
    variables: {
      id: gid,
      tags,
    },
  });

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const resp = await axios(
    {
      method: 'post',
      url: US_SHOPIFY_GRAPHQL_URL, // 'https://drsquatchsoapco.myshopify.com/admin/api/2022-10/graphql.json',
      headers: {
        'X-Shopify-Access-Token': US_SHOPIFY_API_KEY,
        'Content-Type': 'application/json',
      },
      data,
    },
  );
  const { data: respData } = resp;

  console.debug('addTagsInShopifyAdmin, respData:', JSON.stringify(respData), {
    gid,
    tags,
    requestId: resp.headers['X-Request-ID'],
  });

  if (respData.data.tagsAdd.userErrors.length > 0) {
    console.error('tagsAdd userErrors:', JSON.stringify(respData.data.tagsAdd.userErrors));
    throw new Error(respData.data.tagsAdd.userErrors[0].message);
  }
};

/**
 * @description note that each tag is silently truncated to max len of 40,
 * else Shopify would error on adding all tags
 */
export const addTagsInShopifyAdmin = async (gid: string, tags: string[]) => backOff(
  // eslint-disable-next-line no-return-await
  async () => await addTagWithoutRetry(gid, tags.map(tag => tag.substring(0, 40))),
  {
    jitter: 'full',
    retry: (err, attemptNumber) => {
      console.error('addTagsInShopifyAdmin, retry, error:', err);
      console.error('addTagsInShopifyAdmin, retry, attemptNumber:', attemptNumber);
      return true; // keep retrying until (default) numAttempts
    },
  },
);

export const megaRewardsTest = async (shopifyOrder: ShopifyOrderObject) => {
  prefix = shopifyOrder.name.toLowerCase().includes('uk') ? 'EU_' : 'US_';

  const resp = await axios(
    {
      method: 'post',
      url: 'https://0uvw7m1obg.execute-api.us-east-1.amazonaws.com/dev/trigger',
      headers: {
        'Content-Type': 'application/json',
      },
      data: shopifyOrder,
    },
  );
  console.debug(resp);
};

// const addNote = (shopifyOrder: ShopifyOrderObject, cleanedAddress: cleansedAddress) => {
//   // eslint-disable-next-line no-param-reassign
//   shopifyOrder.note = typeof shopifyOrder.note !== 'string' ? '' : shopifyOrder.note;
//   // eslint-disable-next-line no-param-reassign
//   shopifyOrder.note = `${shopifyOrder.note}
//   address-validation-service suggested address:
//   ${JSON.stringify(cleanedAddress)}`;
// };