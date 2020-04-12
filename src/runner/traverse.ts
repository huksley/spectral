import { encodePointerFragment } from '@stoplight/json';
import { JsonPath } from '@stoplight/types';
import { IGivenNode, IRunRule } from '../types';
import { decodeSegmentFragment } from '../utils';

type Callback = (rule: IRunRule, node: IGivenNode) => void;
type Cache = WeakMap<RegExp, boolean>;

function matches(cache: Cache, path: string, pattern: RegExp) {
  const cachedValue = cache.get(pattern);
  if (cachedValue !== void 0) {
    return cachedValue;
  }

  const match = pattern.test(path);
  cache.set(pattern, match);
  return match;
}

function _traverse(curObj: object, rules: IRunRule[], path: JsonPath, cb: Callback) {
  for (const key of Object.keys(curObj)) {
    const value = curObj[key];
    const length = path.push(encodePointerFragment(key));
    const stringifiedPath = path.join('/');

    const node = {
      path: path.map(decodeSegmentFragment),
      value,
    };

    const cache: Cache = new WeakMap();

    for (const rule of rules) {
      if (!Array.isArray(rule.given)) {
        if (matches(cache, stringifiedPath, rule.given as RegExp)) {
          cb(rule, node);
        }
      } else if ((rule.given as RegExp[]).some(pattern => matches(cache, stringifiedPath, pattern))) {
        cb(rule, node);
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
