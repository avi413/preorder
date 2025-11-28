# Cart Lines Add Validation Function

This Shopify Function validates cart line additions for pre-order products.

## Status
Currently a placeholder. To implement:

1. Query pre-order settings from your app's database/API
2. Check if the variant being added is enabled for pre-order
3. Validate quantity against `limitQuantity` if set
4. Add pre-order metadata to cart lines
5. Return appropriate errors or modifications

## Building

```bash
shopify app function build
```

## Testing

Use Shopify CLI to test the function locally before deploying.
