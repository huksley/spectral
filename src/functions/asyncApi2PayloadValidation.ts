import * as AJV from 'ajv';
import * as jsonSpecv7 from 'ajv/lib/refs/json-schema-draft-07.json';

import { addWellKnownFormats, PerformSchemaValidation } from '../functions/schema';
import { IFunction, IFunctionContext } from '../types';
import { IFunctionResult } from '../types/function';

import * as asyncApi2Schema from '../rulesets/asyncapi/schemas/schema.asyncapi2.json';
import { getLintTargets } from '../utils';

export interface IPayloadValidationOptions {
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
const asyncApi2SchemaObject = { $ref: fakeSchemaObjectId };
const validator = mainAjv.compile(asyncApi2SchemaObject);

export const asyncApi2PayloadValidation: IFunction<IPayloadValidationOptions> = function(
  this: IFunctionContext,
  targetVal,
  opts,
  paths,
) {
  // The subsection of the targetVal which contains the good bit
  const relevantItems = getLintTargets(targetVal, opts.field);

  const rootPath = [...(paths.target || paths.given)];

  const results: IFunctionResult[] = [];

  for (const relevantItem of relevantItems) {
    PerformSchemaValidation(validator, relevantItem.value, results, asyncApi2SchemaObject, [
      ...rootPath,
      ...relevantItem.path,
    ]);
  }

  return results;
};

export default asyncApi2PayloadValidation;
