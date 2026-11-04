// Fictional developer QA material. It is never auto-assigned to players.
import {sentences} from '../../dist/reading/model.js';

export function readingFixture(){
 const paragraphs=[
  {
   id:'p1',page:1,
   text:'Mira planted a small garden beside the library. She chose beans because they grow quickly. Each morning, she checked the soil.',
   mainIdea:{prompt:'What is this paragraph mostly about?',choices:['Starting a garden','Buying library books','Flying a kite'],answer:0},
   illustration:{kind:'garden',alt:'An illustrated garden'},
  },
  {
   id:'p2',page:1,
   text:'The soil was dry after three sunny days. Mira watered the roots so the plants could keep growing. A robin watched from the fence.',
   mainIdea:{prompt:'What is this paragraph mostly about?',choices:['Caring for dry plants','Building a fence','Finding a robin nest'],answer:0},
  },
  {
   id:'p3',page:2,
   text:'By Friday, tiny green shoots reached above the soil. Mira shared the news with her neighbor. Next week, they would plant another row together.',
   mainIdea:{prompt:'What is this paragraph mostly about?',choices:['The garden is growing','The library is closed','A storm broke the fence'],answer:0},
  },
 ];
 const questions=[
  ['Why did Mira choose beans?', 'p1', 1, 1, ['beans','choose beans']],
  ['Where did Mira plant the garden?', 'p1', 0, 0, ['garden','plant']],
  ['Why did Mira water the roots?', 'p2', 1, 1, ['water','roots']],
  ['What grew above the soil by Friday?', 'p3', 0, 0, ['grew','Friday','soil']],
  ['Who would plant another row with Mira?', 'p3', 1, 2, ['plant','row','Mira']],
  ['How long had the weather been sunny?', 'p2', 0, 0, ['weather','sunny']],
  ['What bird watched from the fence?', 'p2', 2, 2, ['bird','fence']],
 ].map(([text,paragraphId,first,last,keywords],index)=>{
  const paragraph=paragraphs.find(a=>a.id===paragraphId);
  const spans=sentences(paragraph.text);
  return {
   id:'q'+(index+1),text,keywordGroups:[{any:keywords}],
   evidence:[{paragraphId,start:spans[first].start,end:spans[last].end,explanation:'Your selected words give the detail this mission asks about.'}],
   hints:['Think about the action in your question.','Compare the ideas you have already read.','Think about the topic connected to your mission.'],
   regionHint:'Look for an idea about the garden and the action in your question.',
   rescue:'Ask a grown-up to compare the question and paragraph ideas with you.',
   outline:'Say the idea aloud, then write your own sentence.',
  };
 });
 questions[2].reflection={prompt:'What does this clue tell us?',choices:['Water helped the plants keep growing','The robin watered the library'],answer:0};
 questions[6].worksheet={type:'multiple_choice',choices:['A crow','A robin','A sparrow'],answer:1};
 return {
  schemaVersion:1,id:'fictional-garden-qa',title:'Developer Sample: Mira’s Garden',
  source:'Fictional QA example, not a real worksheet',paragraphs,questions,
 };
}
