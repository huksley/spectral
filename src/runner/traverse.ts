import { decodePointerFragment, encodePointerFragment } from '@stoplight/json';
import { JsonPath, Segment } from '@stoplight/types';
import { IGivenNode, IRunRule } from '../types';

type Callback = (rule: IRunRule, node: IGivenNode) => void;

function decodeSegment(segment: Segment) {
  return typeof segment === 'number' ? segment : decodePointerFragment(segment);
}

function _traverse(curObj: object, rules: IRunRule[], path: JsonPath, cb: Callback) {
  for (const key of Object.keys(curObj)) {
    const value = curObj[key];
    const length = path.push(encodePointerFragment(key));
    const stringifiedPath = path.join('/');

    for (const rule of rules) {
      if (!Array.isArray(rule.given)) {
        if ((rule.given as RegExp).test(stringifiedPath)) {
          cb(rule, {
            path: path.map(decodeSegment).slice(),
            value,
          });
        }
      } else if ((rule.given as RegExp[]).some(pattern => pattern.test(stringifiedPath))) {
        cb(rule, {
          path: path.map(decodeSegment).slice(),
          value,
        });
      }
    }

    if (typeof value === 'object' && value !== null) {
      _traverse(value, rules, path, cb);
    }

    path.length = length - 1;
  }
}

export function traverse(obj: object, rules: IRunRule[], cb: Callback) {
  _traverse(obj, rules, [], cb);
}
