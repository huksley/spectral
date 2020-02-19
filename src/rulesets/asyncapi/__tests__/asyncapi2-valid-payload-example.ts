import { cloneDeep } from 'lodash';

import { buildTestSpectralWithAsyncApiRule } from '../../../../setupTests';
import { Spectral } from '../../../spectral';
import { IRunRule } from '../../../types';

const ruleName = 'asyncapi2-valid-payload-example';
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
    example: { value: 17 },
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

  test('return result if components.messages.{message}.payload.example is not valid against the schema it decorates', async () => {
    const clone = cloneDeep(doc);

    clone.components.messages.aMessage.payload.example = { deprecated: 17 };

    const results = await s.run(clone, { ignoreUnknownFormat: false });

    expect(results).toEqual([
      expect.objectContaining({
        code: ruleName,
        message: 'object should have required property `value`',
        path: ['components', 'messages', 'aMessage', 'payload', 'example'],
        severity: rule.severity,
      }),
      expect.objectContaining({
        code: ruleName,
        message: '`deprecated` property type should be boolean',
        path: ['components', 'messages', 'aMessage', 'payload', 'example', 'deprecated'],
        severity: rule.severity,
      }),
    ]);
  });

  test('return result if components.messageTraits.{trait}.payload.example is not valid against the schema it decorates', async () => {
    const clone = cloneDeep(doc);

    clone.components.messageTraits.aTrait.payload.example = { deprecated: 17 };

    const results = await s.run(clone, { ignoreUnknownFormat: false });

    expect(results).toEqual([
      expect.objectContaining({
        code: ruleName,
        message: 'object should have required property `value`',
        path: ['components', 'messageTraits', 'aTrait', 'payload', 'example'],
        severity: rule.severity,
      }),
      expect.objectContaining({
        code: ruleName,
        message: '`deprecated` property type should be boolean',
        path: ['components', 'messageTraits', 'aTrait', 'payload', 'example', 'deprecated'],
        severity: rule.severity,
      }),
    ]);
  });

  test.each(['publish', 'subscribe'])(
    'return result if channels.{channel}.%s.message.payload.example is not valid against the schema it decorates',
    async (property: string) => {
      const clone = cloneDeep(doc);

      clone.channels['users/{userId}/signedUp'][property].message.payload.example = { deprecated: 17 };

      const results = await s.run(clone, { ignoreUnknownFormat: false });

      expect(results).toEqual([
        expect.objectContaining({
          code: ruleName,
          message: 'object should have required property `value`',
          path: ['channels', 'users/{userId}/signedUp', property, 'message', 'payload', 'example'],
          severity: rule.severity,
        }),
        expect.objectContaining({
          code: ruleName,
          message: '`deprecated` property type should be boolean',
          path: ['channels', 'users/{userId}/signedUp', property, 'message', 'payload', 'example', 'deprecated'],
          severity: rule.severity,
        }),
      ]);
    },
  );
});
