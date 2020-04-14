import { asyncApi2PayloadValidation } from '../asyncApi2PayloadValidation';

function runExampleValidation(targetVal: any, field: string, schemaPath: string) {
  return asyncApi2PayloadValidation(
    targetVal,
    { field, schemaPath },
    { given: ['$', 'components', 'messages', 'aMessage'] },
    { given: null, original: null, documentInventory: {} as any },
  );
}

describe('asyncApi2PayloadValidation', () => {
  test('Properly identify examples that do not fit the payload schema or the AsyncApi2 schema object definition', () => {
    const payload = {
      properties: {
        value: {
          type: 'integer',
        },
      },
      examples: [
        // invalid according to the AsyncApi2 schema object
        17,

        // invalid according to both the payload and the AsincApi2 schema object
        { value: [], deprecated: 7 },

        // valid
        { value: 11 },

        // invalid according to the payload schema
        { value: 'nope' },
      ],
    };

    const results = runExampleValidation(payload, '$.examples.*', '$');

    expect(results).toEqual([
      {
        // Doesn't match the AsyncApi2 schema object
        message: '{{property|gravis|append-property|optional-typeof|capitalize}}type should be object,boolean',
        path: ['$', 'components', 'messages', 'aMessage', 'examples', '0'],
      },
      {
        // Doesn't match the AsyncApi2 schema object
        message: '{{property|gravis|append-property|optional-typeof|capitalize}}type should be object',
        path: ['$', 'components', 'messages', 'aMessage', 'examples', '0'],
      },
      {
        // Doesn't match the payload schema object
        message: '{{property|gravis|append-property|optional-typeof|capitalize}}type should be integer',
        path: ['$', 'components', 'messages', 'aMessage', 'examples', '1', 'value'],
      },
      {
        // Doesn't match the AsincApi2 schema object
        message: '{{property|gravis|append-property|optional-typeof|capitalize}}type should be boolean',
        path: ['$', 'components', 'messages', 'aMessage', 'examples', '1', 'deprecated'],
      },
      {
        // Doesn't match the payload schema object
        message: '{{property|gravis|append-property|optional-typeof|capitalize}}type should be integer',
        path: ['$', 'components', 'messages', 'aMessage', 'examples', '3', 'value'],
      },
    ]);
  });
});
