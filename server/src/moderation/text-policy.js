const bannedProfileTerms = [
  'fuck','fucking','motherfucker','shit','bullshit','bitch','bastard','asshole','arsehole','cunt','dick','dickhead','pussy','cock','whore','slut','twat','wanker','jerkoff','retard','fag','faggot','nigger','nigga','kys','rape','rapist','porn','nudes','nude','sex','sexting',
  'ебать','ебу','ебал','ебан','ёбан','бляд','бля','сука','сучка','хуй','хуя','хуе','пизд','мудил','гандон','залуп','шлюх','секс','порно','дроч','насил','уёб','уеб','мудак','мраз','урод','дебил','идиот','твар','чмо','лох','сдохни','убейся','соси','заеб','нахуй','пошёл нах','пошел нах',
  'scheisse','scheiß','fick','ficken','ficker','arschloch','hure','schlampe','wichser','hurensohn','fotze','schwanz','muschi','vergewaltig','idiot','miststück',
  'putain','merde','connard','connasse','salope','enculé','encule','nique','pute','foutre',
  'puta','puto','joder','mierda','coño','cono','gilipollas','cabron','cabrón','pendejo','chingar','verga','maricon','maricón',
  'cazzo','stronzo','vaffanculo','figa','troia','bastardo',
  'kurwa','chuj','pizda','blyat','suka','cyka','hui','pizdec','pidor','pidaras','zaeb','nahui','huy','huylo','jebac','kurw','dziwka',
];

const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase();
const confusables = { 'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','і':'i','ј':'j','к':'k','м':'m','т':'t','в':'b','н':'h','０':'0','１':'1','３':'3','４':'4','５':'5','７':'7' };
const compact = (value) => normalize(value)
  .replace(/[а-яёіј０-９]/g, char => confusables[char] || char)
  .replace(/[@]/g,'a').replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t')
  .replace(/[\s._*\-+!#$%^&()\[\]{}:;'\"~`/\\|]+/g, '');

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
      const canonicalTerm = compact(normalizedTerm);
      return tokens.some(token => token === normalizedTerm || token.startsWith(normalizedTerm)) || compactTokens.some(token =>
        token.value === canonicalTerm || (token.hasSeparators && token.value.includes(canonicalTerm))
      );
    }

    return compactTokens.some(token => token.value.includes(compact(normalizedTerm)));
  });
}
