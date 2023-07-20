import { backOff } from 'exponential-backoff';
import axios from 'axios';
import { ShopifyOrderObject } from './types/shopify';
import { getChannelInfo } from './shopifyScripts';

const { SHOPIFY_GRAPHQL_URL, SHOPIFY_API_KEY } = process.env;

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
      url: SHOPIFY_GRAPHQL_URL,
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_API_KEY,
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

export const tagCustomerInShopify = async (
  shopifyOrder: ShopifyOrderObject,
  tags: string[],
) => addTagsInShopifyAdmin(
  shopifyOrder.customer.admin_graphql_api_id,
  tags,
);

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
      url: SHOPIFY_GRAPHQL_URL,
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_API_KEY,
        'Content-Type': 'application/json',
      },
      data,
    },
  );
  const { data: respData } = resp;

  console.debug('this is the api key for this store', SHOPIFY_API_KEY);
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