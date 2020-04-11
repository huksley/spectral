import { DiagnosticSeverity, Optional } from '@stoplight/types';
import { JSONPathCallback } from 'jsonpath-plus';
import { STDIN } from '../document';
import { DocumentInventory } from '../documentInventory';
import { getDiagnosticSeverity } from '../rulesets/severity';
import { IRuleResult, IRunRule } from '../types';
import { hasIntersectingElement } from '../utils';
import { generateDocumentWideResult } from '../utils/generateDocumentWideResult';
import { IExceptionLocation, pivotExceptions } from '../utils/pivotExceptions';
import { lintNode } from './linter';
import { traverse } from './traverse';
import { IRunnerInternalContext, IRunnerPublicContext } from './types';

const { JSONPath } = require('jsonpath-plus');

export const isRuleEnabled = (rule: IRunRule) =>
  rule.severity !== void 0 && getDiagnosticSeverity(rule.severity) !== -1;

const isStdInSource = (inventory: DocumentInventory): boolean => {
  return inventory.document.source === STDIN;
};

const generateDefinedExceptionsButStdIn = (documentInventory: DocumentInventory): IRuleResult => {
  return generateDocumentWideResult(
    documentInventory.document,
    'The ruleset contains `except` entries. However, they cannot be enforced when the input is passed through stdin.',
    DiagnosticSeverity.Warning,
    'except-but-stdin',
  );
};

export const runRules = async (context: IRunnerPublicContext): Promise<IRuleResult[]> => {
  const { documentInventory, rules, exceptions } = context;

  const runnerContext: IRunnerInternalContext = {
    ...context,
    results: [],
    promises: [],
  };

  const isStdIn = isStdInSource(documentInventory);
  const exceptRuleByLocations = isStdIn ? {} : pivotExceptions(exceptions, rules);

  if (isStdIn && Object.keys(exceptions).length > 0) {
    runnerContext.results.push(generateDefinedExceptionsButStdIn(documentInventory));
  }

  const relevantRules = Object.values(rules).filter(
    rule =>
      isRuleEnabled(rule) &&
      (rule.formats === void 0 ||
        (documentInventory.formats !== null &&
          documentInventory.formats !== void 0 &&
          hasIntersectingElement(rule.formats, documentInventory.formats))),
  );

  // const group = {
  //
  // }

  // for (const rule of relevantRules) {
  //
  // }
  const optimizedRules = relevantRules.filter(
    rule => rule.given instanceof RegExp || (Array.isArray(rule.given) && rule.given[0] instanceof RegExp),
  );
  const unoptimizedRules = relevantRules.filter(rule => !optimizedRules.includes(rule));
  // const target = rule.resolved === false ? context.documentInventory.unresolved : context.documentInventory.resolved;

  // todo: distinguish between unresolved and resolved
  traverse(Object(runnerContext.documentInventory.resolved), optimizedRules, (rule, node) => {
    lintNode(runnerContext, node, rule, exceptRuleByLocations[rule.name]);
  });

  for (const rule of unoptimizedRules) {
    runRule(runnerContext, rule, exceptRuleByLocations[rule.name]);
  }

  if (runnerContext.promises.length > 0) {
    await Promise.all(runnerContext.promises);
  }

  return runnerContext.results;
};

const runRule = (
  context: IRunnerInternalContext,
  rule: IRunRule,
  exceptRuleByLocations: Optional<IExceptionLocation[]>,
): void => {
  const target = rule.resolved === false ? context.documentInventory.unresolved : context.documentInventory.resolved;

  for (const given of Array.isArray(rule.given) ? rule.given : [rule.given]) {
    // don't have to spend time running jsonpath if given is $ - can just use the root object
    if (given === '$') {
      lintNode(
        context,
        {
          path: ['$'],
          value: target,
        },
        rule,
        exceptRuleByLocations,
      );
    } else {
      JSONPath({
        path: given,
        json: target,
        resultType: 'all',
        callback: (result => {
          lintNode(
            context,
            {
              path: JSONPath.toPathArray(result.path),
              value: result.value,
            },
            rule,
            exceptRuleByLocations,
          );
        }) as JSONPathCallback,
      });
    }
  }
};
