"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTagsInShopifyAdmin = exports.tagCustomerInShopify = exports.isSpecificChannelOrder = exports.getCustomerOrderCount = void 0;
const exponential_backoff_1 = require("exponential-backoff");
const axios_1 = __importDefault(require("axios"));
const shopifyScripts_1 = require("./shopifyScripts");
const { SHOPIFY_GRAPHQL_URL, SHOPIFY_API_KEY } = process.env;
const getCustomerOrderCount = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exponential_backoff_1.backOff)(
    // eslint-disable-next-line no-return-await
    () => __awaiter(void 0, void 0, void 0, function* () { return yield getCustomerOrderCountWithoutRetry(shopifyOrder); }), {
        jitter: 'full',
        retry: (err, attemptNumber) => {
            console.error('getCustomerOrderCount, retry, error:', err);
            console.error('getCustomerOrderCount, retry, attemptNumber:', attemptNumber);
            return true; // keep retrying until (default) numAttempts
        },
    });
});
exports.getCustomerOrderCount = getCustomerOrderCount;
const getCustomerOrderCountWithoutRetry = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.stringify({
        query: `{ query: customer(id: "gid://shopify/Customer/${shopifyOrder.customer.id}") {
        numberOfOrders
      }
    }`,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const resp = yield (0, axios_1.default)({
        method: 'post',
        url: SHOPIFY_GRAPHQL_URL,
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_API_KEY,
            'Content-Type': 'application/json',
        },
        data,
    });
    const { data: respData } = resp;
    if (respData.errors && Array.isArray(respData.errors) && respData.errors.length > 0) {
        console.error('respData.errors:', JSON.stringify(respData.errors));
        throw new Error(respData.errors[0].message);
    }
    if (respData.data && respData.data.userErrors
        && Array.isArray(respData.data.userErrors)
        && respData.data.userErrors.length > 0) {
        console.error('respData.data.userErrors:', JSON.stringify(respData.data.userErrors));
        throw new Error(respData.data.userErrors[0].message);
    }
    return Number(respData.data.query.numberOfOrders);
});
const isSpecificChannelOrder = (shopifyOrder, channelHandles) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { data: { handle: channelHandle } } = yield (0, shopifyScripts_1.getChannelInfo)(shopifyOrder.id);
        console.debug('isSpecificChannelOrder debug:', { orderId: shopifyOrder.id, channelHandle: channelHandle });
        return channelHandles.includes(channelHandle);
    }
    catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.debug('isSpecificChannelOrder, err:', err.stack);
        return false;
    }
});
exports.isSpecificChannelOrder = isSpecificChannelOrder;
const tagCustomerInShopify = (shopifyOrder, tags) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.addTagsInShopifyAdmin)(shopifyOrder.customer.admin_graphql_api_id, tags);
});
exports.tagCustomerInShopify = tagCustomerInShopify;
const addTagsInShopifyAdmin = (gid, tags) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exponential_backoff_1.backOff)(
    // eslint-disable-next-line no-return-await
    () => __awaiter(void 0, void 0, void 0, function* () { return yield addTagWithoutRetry(gid, tags.map(tag => tag.substring(0, 40))); }), {
        jitter: 'full',
        retry: (err, attemptNumber) => {
            console.error('addTagsInShopifyAdmin, retry, error:', err);
            console.error('addTagsInShopifyAdmin, retry, attemptNumber:', attemptNumber);
            return true; // keep retrying until (default) numAttempts
        },
    });
});
exports.addTagsInShopifyAdmin = addTagsInShopifyAdmin;
const addTagWithoutRetry = (gid, tags) => __awaiter(void 0, void 0, void 0, function* () {
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
    const resp = yield (0, axios_1.default)({
        method: 'post',
        url: SHOPIFY_GRAPHQL_URL,
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_API_KEY,
            'Content-Type': 'application/json',
        },
        data,
    });
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
});
