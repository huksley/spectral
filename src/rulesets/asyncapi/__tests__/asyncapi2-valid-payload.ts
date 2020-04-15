import { cloneDeep } from 'lodash';

import { buildTestSpectralWithAsyncApiRule } from '../../../../setupTests';
import { Spectral } from '../../../spectral';
import { IRunRule } from '../../../types';

const ruleName = 'asyncapi2-valid-payload';
let s: Spectral;
let rule: IRunRule;

describe(`Rule '${ruleName}'`, () => {
  beforeEach(async () => {
    [s, rule] = await buildTestSpectralWithAsyncApiRule(ruleName);
  });

  const payload = {
    type: 'object',
    properties: {
      value: {
        type: 'integer',
      },
    },
    required: ['value'],
  };

  const doc: any = {
    asyncapi: '2.0.0',
    channels: {
      'users/{userId}/signedUp': {
        publish: {
          message: {
            payload: cloneDeep(payload),
          },
        },
        subscribe: {
          message: {
            payload: cloneDeep(payload),
          },
        },
      },
    },
    components: {
      messageTraits: {
        aTrait: {
          payload: cloneDeep(payload),
        },
      },
      messages: {
        aMessage: {
          payload: cloneDeep(payload),
        },
      },
    },
  };

  test('validates a correct object', async () => {
    const results = await s.run(doc, { ignoreUnknownFormat: false });

    expect(results).toEqual([]);
  });

  test('return result if components.messages.{message}.payload.default is not valid against the schema it decorates', async () => {
    const clone = cloneDeep(doc);

    clone.components.messages.aMessage.payload.deprecated = 17;

    const results = await s.run(clone, { ignoreUnknownFormat: false });

    expect(results).toEqual([
      expect.objectContaining({
        code: ruleName,
        message: '`deprecated` property type should be boolean',
        path: ['components', 'messages', 'aMessage', 'payload', 'deprecated'],
        severity: rule.severity,
      }),
    ]);
  });

  test('return result if components.messageTraits.{trait}.payload.default is not valid against the schema it decorates', async () => {
    const clone = cloneDeep(doc);

    clone.components.messageTraits.aTrait.payload.deprecated = 17;

    const results = await s.run(clone, { ignoreUnknownFormat: false });

    expect(results).toEqual([
      expect.objectContaining({
        code: ruleName,
        message: '`deprecated` property type should be boolean',
        path: ['components', 'messageTraits', 'aTrait', 'payload', 'deprecated'],
        severity: rule.severity,
      }),
    ]);
  });

  test.each(['publish', 'subscribe'])(
    'return result if channels.{channel}.%s.message.payload.default is not valid against the schema it decorates',
    async (property: string) => {
      const clone = cloneDeep(doc);

      clone.channels['users/{userId}/signedUp'][property].message.payload.deprecated = 17;

      const results = await s.run(clone, { ignoreUnknownFormat: false });

      expect(results).toEqual([
        expect.objectContaining({
          code: ruleName,
          message: '`deprecated` property type should be boolean',
          path: ['channels', 'users/{userId}/signedUp', property, 'message', 'payload', 'deprecated'],
          severity: rule.severity,
        }),
      ]);
    },
  );
});