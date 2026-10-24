const bannedProfileTerms=[
 'fuck','fucking','motherfucker','shit','bullshit','bitch','bastard','asshole','arsehole','cunt','dick','dickhead','pussy','cock','whore','slut','twat','wanker','jerkoff','retard','fag','faggot','nigger','nigga','kys','rape','rapist','porn','nudes','nude','sex','sexting',
 'ебать','ебу','ебал','ебан','ёбан','бляд','бля','сука','сучка','хуй','хуя','хуе','пизд','мудил','гандон','залуп','шлюх','секс','порно','дроч','насил','уёб','уеб','мудак','мраз','урод','дебил','идиот','твар','чмо','лох','сдохни','убейся','соси','заеб','нахуй','пошёл нах','пошел нах',
 'scheisse','scheiß','fick','ficken','ficker','arschloch','hure','schlampe','wichser','hurensohn','fotze','schwanz','muschi','vergewaltig','bastard','idiot','miststück',
 'putain','merde','connard','connasse','salope','enculé','encule','nique','pute','foutre',
 'puta','puto','joder','mierda','coño','cono','gilipollas','cabron','cabrón','pendejo','chingar','verga','maricon','maricón',
 'cazzo','stronzo','vaffanculo','figa','troia','bastardo',
 'kurwa','chuj','pizda','blyat','suka','cyka','hui','pizdec','pidor','pidaras','zaeb','nahui','huy','huylo','jebac','kurw','dziwka',
];
export function profileTextProblem(values){
 const text=values.filter(v=>typeof v==='string').join(' ').normalize('NFKC').toLocaleLowerCase();
 const compact=text.replace(/[\s._*\-+!@#$%^&()\[\]{}:;'"~`/\\|]+/g,'');
 return bannedProfileTerms.some(term=>text.includes(term)||compact.includes(term.replace(/[^a-zа-яё]/gi,'')));
}
