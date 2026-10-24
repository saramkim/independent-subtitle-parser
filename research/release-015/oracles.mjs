// Authored from the pinned source files and public time/text rules, before
// evaluating this parser. These fixtures are samples, not film-scale coverage.
import { readFileSync } from 'node:fs';
export const upstreamCases = [
  { path: 'corpus/release-015/libass/sub1.ass', format: 'ass', expected: [[0, 4000, 'A']], raw: ['{\\t(\\frz+180)}A'] },
  { path: 'corpus/release-015/libass/sub2.ass', format: 'ass', expected: [[150000, 155000, 'Test_']], raw: ['{\\blur1}Test_'] },
  { path: 'corpus/release-015/microsoft/ccsample.smi', format: 'sami', expected: [
    [1000, 4000, 'Great reason to visit Seattle, brought to you by two out-of-staters.'],
    [4000, 7000, "So you know, there's lots of great reasons to come visit Seattle."],
    [7000, 9000, "That's right, I came here because of the coffee."],
    [9000, 12000, 'Yah, everyone knows the coffee.'],
    [12000, 14000, 'And I heard about the drivers.'],
    [14000, 19000, "Well, you know, but then it rains...and it's bad, it's bad."],
    [19000, 21000, 'But the traffic in general is...'],
    [21000, 23000, 'Terrible.'],
    [23000, 26500, 'OK, yah, yah. But, the weather!'],
    [26500, 30000, "It doesn't rain all the time...yes, it does."],
    [30000, 34000, 'Yah. Nevermind.'],
    [34000, null, 'End of Stream.'],
  ] },
];
export const loadUpstreamCases = () => upstreamCases.map(c => ({ ...c, source: readFileSync(c.path, 'utf8') }));
