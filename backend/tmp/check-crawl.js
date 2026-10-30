require('./backend/node_modules/dotenv').config({path:'./backend/.env'});
const { crawlSite } = require('./backend/src/services/crawler.js');
(async () => {
  const result = await crawlSite('https://onewaynepal.com');
  const idx = result.text.indexOf('Nepal');
  console.log('Nepal at index:', idx);
  console.log('Surrounding text:', JSON.stringify(result.text.substring(Math.max(0, idx-20), idx+30)));
  const nebIdx = result.text.indexOf('Nebal');
  console.log('Nebal at index:', nebIdx);
  // Check all occurrences of 'Nepal' and surrounding context
  let pos = 0;
  while ((pos = result.text.indexOf('Nepal', pos)) !== -1) {
    console.log('Nepal at', pos, ':', JSON.stringify(result.text.substring(pos-10, pos+15)));
    pos += 5;
  }
})();