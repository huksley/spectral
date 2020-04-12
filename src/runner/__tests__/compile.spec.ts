import { compile } from '../compile';

describe('compile', () => {
  it('compile', () => {
    expect(compile('$..*')).toEqual(/./);
    expect(compile('$.info.contact')).toEqual(/^info\/contact$/);
    expect(compile('$.info.contact.*')).toEqual(/^info\/contact\/[^/]*$/);
    expect(compile('$.servers[*].url')).toEqual(/^servers\/[0-9]+\/url$/);

    expect(compile('$..empty')).toEqual(/(?:^|\/)empty$/);
    expect(compile(`$..[?(@property === 'description' || @property === 'title')]`)).toEqual(
      /(?:^|\/)(?:description|title)$/,
    );

    expect(compile('$.paths..content.*.examples')).toEqual(/^paths\/?.*\/content\/[^/]*\/examples$/);
  });

  it('aot subscript', () => {
    expect(compile("$.paths.*[?( @property === 'get' || @property === 'put' || @property === 'post' )]")).toEqual(
      /^paths\/[^/]*\/(?:get|put|post)$/,
    );
  });

  it.each(['$..headers..[?(@.example && @.schema)]', '$.paths.*[?( @property >= 400 )]'])('%s is unsupported', expr => {
    expect(compile(expr)).toBeNull();
  });
});
