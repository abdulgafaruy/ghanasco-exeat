const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'house123';
  const hash = await bcrypt.hash(password, 10);
  
  console.log('\n===========================================');
  console.log('PASSWORD HASH FOR: house123');
  console.log('===========================================\n');
  console.log(hash);
  console.log('\n===========================================');
  console.log('SQL COMMAND TO UPDATE DATABASE:');
  console.log('===========================================\n');
  console.log(`UPDATE users SET password_hash = '${hash}';`);
  console.log('\n===========================================\n');
}

generateHash();