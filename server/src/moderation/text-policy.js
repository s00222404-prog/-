const bannedProfileTerms = [
  'fuck','fucking','motherfucker','shit','bullshit','bitch','bastard','asshole','arsehole','cunt','dick','dickhead','pussy','cock','whore','slut','twat','wanker','jerkoff','retard','fag','faggot','nigger','nigga','kys','rape','rapist','porn','nudes','nude','sex','sexting',
  'ебать','ебу','ебал','ебан','ёбан','бляд','бля','сука','сучка','хуй','хуя','хуе','пизд','мудил','гандон','залуп','шлюх','секс','порно','дроч','насил','уёб','уеб','мудак','мраз','урод','дебил','идиот','твар','чмо','лох','сдохни','убейся','соси','заеб','нахуй','пошёл нах','пошел нах',
  'scheisse','scheiß','fick','ficken','ficker','arschloch','hure','schlampe','wichser','hurensohn','fotze','schwanz','muschi','vergewaltig','idiot','miststück',
  'putain','merde','connard','connasse','salope','enculé','encule','nique','pute','foutre',
  'puta','puto','joder','mierda','coño','cono','gilipollas','cabron','cabrón','pendejo','chingar','verga','maricon','maricón',
  'cazzo','stronzo','vaffanculo','figa','troia','bastardo',
  'kurwa','chuj','pizda','blyat','suka','cyka','hui','pizdec','pidor','pidaras','zaeb','nahui','huy','huylo','jebac','kurw','dziwka',
];

const compact = (value) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s._*\-+!@#$%^&()\[\]{}:;'"~`/\\|]+/g, '');
const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase();

export function profileTextProblem(values) {
  const text = normalize(values.filter(v => typeof v === 'string').join(' '));
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const compactTokens = text.split(/\s+/u).filter(Boolean).map(raw => ({
    raw,
    value: compact(raw),
    hasSeparators: /[._*\-+!@#$%^&()\[\]{}:;'"~`/\\|]/u.test(raw)
  }));

  return bannedProfileTerms.some(term => {
    const normalizedTerm = normalize(term);
    if (normalizedTerm.includes(' ')) {
      const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      return new RegExp('(^|[^\\p{L}\\p{N}])' + escaped + '($|[^\\p{L}\\p{N}])', 'u').test(text);
    }

    // Short words such as "sex" and "rape" must not match inside harmless
    // words like "Essex" and "grape". Punctuation-obfuscated forms still match.
    if (normalizedTerm.length <= 4) {
      return tokens.includes(normalizedTerm) || compactTokens.some(token =>
        token.hasSeparators && token.value.includes(compact(normalizedTerm))
      );
    }

    return compactTokens.some(token => token.value.includes(compact(normalizedTerm)));
  });
}
