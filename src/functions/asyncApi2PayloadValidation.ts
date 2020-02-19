import * as AJV from 'ajv';
import * as jsonSpecv7 from 'ajv/lib/refs/json-schema-draft-07.json';
import { JSONPath } from 'jsonpath-plus';

import { addWellKnownFormats, IAjvValidator, PerformSchemaValidation } from '../functions/schema';
import { IFunction, IFunctionContext } from '../types';
import { IFunctionResult } from '../types/function';

import * as asyncApi2Schema from '../rulesets/asyncapi/schemas/schema.asyncapi2.json';
import { getLintTargets } from '../utils';

export interface IPayloadValidationOptions {
  schemaPath: string;
  field?: string;
}

const buildAsyncApi2SchemaObjectValidator = (): AJV.Ajv => {
  const ajvOpts: AJV.Options = {
    meta: false,
    jsonPointers: true,
    allErrors: true,
  };

  const ajv = new AJV(ajvOpts);
  ajv.addMetaSchema(jsonSpecv7);

  addWellKnownFormats(ajv);

  ajv.addSchema(asyncApi2Schema, asyncApi2Schema.$id);

  return ajv;
};

const mainAjv = buildAsyncApi2SchemaObjectValidator();
const fakeSchemaObjectId = 'asyncapi2#schemaObject';

export const asyncApi2PayloadValidation: IFunction<IPayloadValidationOptions> = function(
  this: IFunctionContext,
  targetVal,
  opts,
  paths,
) {
  // The subsection of the targetVal which contains the good bit
  const relevantItems = getLintTargets(targetVal, opts.field);

  // The subsection of the targetValue which contains the schema for us to validate the good bit against
  const schemaObject = JSONPath({ path: opts.schemaPath, json: targetVal })[0];

  const rootPath = [...(paths.target || paths.given)];

  const results: IFunctionResult[] = [];

  for (const relevantItem of relevantItems) {
    const combinedSchemas = {
      allOf: [
        // First ensure the document is valid against the payload schema object
        schemaObject,
        // Then ensure it's also valid against the AsyncAPI2 schema object
        { $ref: fakeSchemaObjectId },
      ],
    };

    const val: IAjvValidator = (data: any): boolean | PromiseLike<boolean> => {
      const res = mainAjv.validate(combinedSchemas, data);
      val.errors = mainAjv.errors;
      return res;
    };

    PerformSchemaValidation(val, relevantItem.value, results, combinedSchemas, [...rootPath, ...relevantItem.path]);
  }

  return results;
};

export default asyncApi2PayloadValidation;
