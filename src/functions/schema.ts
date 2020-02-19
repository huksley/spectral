import { decodePointerFragment } from '@stoplight/json';
import { JsonPath, Optional } from '@stoplight/types';
import * as AJV from 'ajv';
import * as jsonSpecv4 from 'ajv/lib/refs/json-schema-draft-04.json';
import * as jsonSpecv6 from 'ajv/lib/refs/json-schema-draft-06.json';
import { IOutputError } from 'better-ajv-errors';
import { capitalize, escapeRegExp } from 'lodash';
import { IFunction, IFunctionResult, IRule, JSONSchema, RuleFunction } from '../types';
const oasFormatValidator = require('ajv-oai/lib/format-validator');
const betterAjvErrors = require('better-ajv-errors/lib/modern');

export interface ISchemaOptions {
  schema: object;
  // The oasVersion, either 2 or 3 for OpenAPI Spec versions, could also be 3.1 or a larger number if there's a need for it, otherwise JSON Schema
  oasVersion?: Optional<number>;
  allErrors?: boolean;

  // this is used by oasDocumentSchema function, to be removed once we sort out
  prepareResults?(errors: AJV.ErrorObject[]): void;
}

export type SchemaRule = IRule<RuleFunction.SCHEMA, ISchemaOptions>;

interface IAJVOutputError extends IOutputError {
  path?: string;
}

const logger = {
  warn(...args: any[]) {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      if (firstArg.startsWith('unknown format')) return;
      console.warn(...args);
    }
  },
  log: console.log,
  error: console.error,
};

const ajvInstances = {};

export const addWellKnownFormats = (ajv: AJV.Ajv): void => {
  ajv.addFormat('int32', { type: 'number', validate: oasFormatValidator.int32 });
  ajv.addFormat('int64', { type: 'number', validate: oasFormatValidator.int64 });
  ajv.addFormat('float', { type: 'number', validate: oasFormatValidator.float });
  ajv.addFormat('double', { type: 'number', validate: oasFormatValidator.double });
  ajv.addFormat('byte', { type: 'string', validate: oasFormatValidator.byte });
};

function getAjv(oasVersion: Optional<number>, allErrors: Optional<boolean>): AJV.Ajv {
  const type: string = oasVersion && oasVersion >= 2 ? 'oas' + oasVersion : 'jsonschema';
  if (typeof ajvInstances[type] !== 'undefined') {
    return ajvInstances[type];
  }

  const ajvOpts: AJV.Options = {
    meta: true, // Add default meta schemas (draft 7 at the moment)
    schemaId: 'auto',
    allErrors,
    jsonPointers: true,
    unknownFormats: 'ignore',
    nullable: oasVersion === 3, // Support nullable for OAS3
    logger,
  };
  const ajv = new AJV(ajvOpts);
  // We need v4 for OpenAPI and it doesn't hurt to have v6 as well.
  ajv.addMetaSchema(jsonSpecv4);
  ajv.addMetaSchema(jsonSpecv6);

  // @ts-ignore
  ajv._opts.defaultMeta = jsonSpecv4.id;
  // @ts-ignore
  ajv._refs['http://json-schema.org/schema'] = 'http://json-schema.org/draft-04/schema';

  addWellKnownFormats(ajv);

  ajvInstances[type] = ajv;
  return ajv;
}

function getSchemaId(schemaObj: JSONSchema): void | string {
  if ('$id' in schemaObj) {
    return schemaObj.$id;
  }

  if ('id' in schemaObj) {
    return schemaObj.id;
  }
}

export interface IAjvValidator {
  (data: any): boolean | PromiseLike<any>;
  errors?: null | AJV.ErrorObject[];
}

const validators = new (class extends WeakMap<JSONSchema, IAjvValidator> {
  public get({ schema: schemaObj, oasVersion, allErrors }: ISchemaOptions) {
    const ajv = getAjv(oasVersion, allErrors);
    const schemaId = getSchemaId(schemaObj);
    let validator = schemaId !== void 0 ? ajv.getSchema(schemaId) : void 0;
    if (validator !== void 0) {
      return validator;
    }

    validator = super.get(schemaObj);
    if (validator === void 0) {
      // compiling might give us some perf improvements
      validator = ajv.compile(schemaObj);
      super.set(schemaObj, validator);
    }

    return validator;
  }
})();

const replaceProperty = (
  substring: string,
  potentialProperty: Optional<number | string>,
  propertyName: Optional<string>,
) => {
  if (typeof potentialProperty === 'string' && propertyName !== void 0) {
    return `Property \`${propertyName}\``;
  }

  return '{{property|gravis|append-property|optional-typeof|capitalize}}';
};

const cleanAJVErrorMessage = (message: string, path: Optional<string>, suggestion: Optional<string>, type: string) => {
  let cleanMessage = message.trim();

  if (path) {
    cleanMessage = message.replace(
      new RegExp(`^${escapeRegExp(decodePointerFragment(path))}:?\\s*(?:(Property\\s+)([^\\s]+))?`),
      replaceProperty,
    );
  } else if (cleanMessage.startsWith(':')) {
    cleanMessage = cleanMessage.replace(/:\s*/, replaceProperty);
  } else if (cleanMessage.startsWith('Property ')) {
    cleanMessage = cleanMessage.replace(/(Property\s+)([^\s]+)/, replaceProperty);
  } else {
    cleanMessage = `${capitalize(type)} ${cleanMessage}`;
  }

  return `${cleanMessage.replace(/['"]/g, '`')}${
    typeof suggestion === 'string' && suggestion.length > 0 ? `. ${suggestion}` : ''
  }`;
};

export const schema: IFunction<ISchemaOptions> = (targetVal, opts, paths) => {
  const results: IFunctionResult[] = [];

  const path = paths.target || paths.given;

  if (targetVal === void 0) {
    return [
      {
        path,
        message: `{{property|gravis|append-property}}does not exist`,
      },
    ];
  }

  // we already access a resolved object in src/functions/schema-path.ts
  const { schema: schemaObj } = opts;

  // we used the compiled validation now, hence this lookup here (see the logic above for more info)
    const validator: IAjvValidator = validators.get(opts);

  PerformSchemaValidation(validator, targetVal, results, schemaObj, path);

  return results;
};

export function PerformSchemaValidation(
  validator: IAjvValidator,
  targetVal: any,
  results: IFunctionResult[],
  schemaObj: object,
  path: JsonPath,
) {
  try {
    if (!validator(targetVal) && validator.errors) {
      opts.prepareResults?.(validator.errors);

      try {
        results.push(
          ...(betterAjvErrors(schemaObj, targetVal, validator.errors, { format: 'js' }) as IAJVOutputError[]).map(
            ({ suggestion, error, path: errorPath }) => ({
              message: cleanAJVErrorMessage(error, errorPath, suggestion, typeof targetVal),
              path: [...path, ...(errorPath ? errorPath.replace(/^\//, '').split('/') : [])],
            }),
          ),
        );
      } catch {
        results.push(
          ...validator.errors.map(({ message, dataPath }) => ({
            message: message ? cleanAJVErrorMessage(message, dataPath, void 0, typeof targetVal) : '',
            path: [
              ...path,
              ...dataPath
                .split('/')
                .slice(1)
                .map(decodePointerFragment),
            ],
          })),
        );
      }
    }
  } catch (ex) {
    if (ex instanceof AJV.MissingRefError) {
      results.push({
        message: ex.message,
        path,
      });
    } else {
      throw ex;
    }
  }
}
