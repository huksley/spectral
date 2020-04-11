import * as jsep from 'jsep';
import { escapeRegExp } from 'lodash';

const { Parser } = require('./parser/parser');

const cache = new Map<string, RegExp | null>();

export function compile(path: string): RegExp | null {
  if (path === '$') {
    return null;
  }

  const cachedValue = cache.get(path);
  if (cachedValue !== void 0) {
    return cachedValue;
  }

  try {
    const parser = new Parser();
    const ast = parser.parse(path);
    const segments: string[] = [];

    for (const node of ast) {
      const { expression, operation, scope } = node;
      if (expression.type === 'root') continue;
      switch (operation) {
        case 'member':
          switch (expression.type) {
            case 'root':
              break;
            case 'identifier':
              if (scope === 'descendant') {
                segments.push(`(?:.*\/${escapeRegExp(expression.value)}|${escapeRegExp(expression.value)})`);
              } else {
                segments.push(escapeRegExp(expression.value));
              }

              break;
            case 'wildcard':
              if (scope === 'descendant') {
                segments.push('.*');
              } else {
                segments.push('\\/?[^/]*');
              }

              break;
            default:
              throw new Error('Unsupported syntax');
          }

          break;

        case 'subscript':
          if (expression.type === 'wildcard') {
            segments.push('[0-9]+');
          } else {
            segments.push(serializeFilterExpression(expression.value.replace(/^\?/, '')));
          }
          break;
        default:
          throw new Error('Unsupported syntax');
      }
    }

    const value = new RegExp(`^${segments.join('\\/')}$`);
    cache.set(path, value);
    return value;
  } catch {
    cache.set(path, null);
    return null;
  }
}

function serializeFilterExpression(expr: string) {
  return `(?:${serializeESTree(jsep(expr.replace(/^\?/, '').replace(/@property/g, '_property')))})`;
}

function serializeESTree(node: jsep.Expression): string {
  switch (node.type) {
    case 'LogicalExpression':
      if ((node as jsep.LogicalExpression).operator !== '||') {
        throw new Error('Unsupported syntax');
      }

      return `${serializeESTree((node as jsep.LogicalExpression).left)}|${serializeESTree(
        (node as jsep.LogicalExpression).right,
      )}`;

    case 'BinaryExpression':
      if ((node as jsep.BinaryExpression).operator !== '===' && (node as jsep.BinaryExpression).operator !== '==') {
        throw new Error('Unsupported syntax');
      }

      return (
        serializeESTree((node as jsep.BinaryExpression).left) + serializeESTree((node as jsep.BinaryExpression).right)
      );

    case 'Identifier':
      if ((node as jsep.Identifier).name === '_property') {
        return '';
      }

      throw new Error('Unsupported identifier');

    case 'Literal':
      if (typeof (node as jsep.Literal).value !== 'string' && typeof (node as jsep.Literal).value !== 'number') {
        throw new Error('Unsupported literal');
      }

      return String((node as jsep.Literal).value);
    default:
      throw new Error('Unsupported syntax');
  }
}

export function transformJsonPathsExpressions(
  expressions: string | string[] | RegExp | RegExp[],
): RegExp | RegExp[] | string | string[] {
  if (typeof expressions === 'string') {
    return compile(expressions) ?? expressions;
  }

  if (!Array.isArray(expressions) || isTransformedExpressionArray(expressions)) {
    return expressions;
  }

  const transformedExpressions: RegExp[] = [];
  for (const item of expressions) {
    const compiled = compile(item);
    if (compiled !== null) {
      transformedExpressions.push(compiled);
    } else {
      return expressions;
    }
  }

  return transformedExpressions;
}

function isTransformedExpressionArray(arr: RegExp[] | string[]): arr is RegExp[] {
  return arr.length === 0 || typeof arr[0] !== 'string';
}
