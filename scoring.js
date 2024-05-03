
const announce = process.argv.slice(2).join('\n\n').replace(/\s+/g, ' ');

if (!announce) {
  console.log('Usage: node scoring.js <announce>');
  return
}

console.log('Announce:', announce);

matches = [/filles uniquement/i, /rez-de-chaussée|rdc\ /, /Colocs/, /local\ |garage\ |vélo\ |vélo\ /i, /salon|séjour/i, /terrasse|balcon/, /frais|charges/]

for (const match of matches) {
  if (announce.match(match)) {
    console.log('✅ ', match.toString());
    // For each match, display the complete sentence

    try {

      const words = announce.split(' ');
      const index = words.findIndex(word => word.match(match));

      // Find the start and end indices of the sentence
      let start = index;
      while (start > 0 && !words[start - 1].endsWith('.')) {
        //console.log('🔍', words[start - 1])
        start--;
      }
      let end = index;
      while (end < words.length - 1 && !words[end - 1].endsWith('.')) {
        end++;
      }

      // Extract the sentence
      const sentence = words.slice(start, end + 1).join(' ');
      console.log('🔍', sentence);
    } catch (_error) {
      console.log('🔍', 'Unable to show sentence');
    }
  } else {
    console.log('❌', match);
  }
}
