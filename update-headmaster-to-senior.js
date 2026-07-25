// update-headmaster-to-senior.js
// Automated script to update all backend files from headmaster to senior_housemaster

const fs = require('fs');
const path = require('path');

console.log('🔄 Starting Backend Update: Headmaster → Senior Housemaster\n');

// Files to update
const filesToUpdate = [
  'server/middleware/auth.js',
  'server/routes/requests.js',
  'server/routes/users.js',
  'server/routes/houses.js',
  'server/routes/audit.js',
  'server/routes/analytics.js'
];

// Replacement patterns
const replacements = [
  {
    pattern: /requireHeadmaster/g,
    replacement: 'requireSeniorHousemaster',
    description: 'Function name'
  },
  {
    pattern: /'headmaster'/g,
    replacement: "'senior_housemaster'",
    description: 'Role string (single quotes)'
  },
  {
    pattern: /"headmaster"/g,
    replacement: '"senior_housemaster"',
    description: 'Role string (double quotes)'
  },
  {
    pattern: /Headmaster only/g,
    replacement: 'Senior Housemaster only',
    description: 'Error messages'
  },
  {
    pattern: /Access denied\. Headmaster/g,
    replacement: 'Access denied. Senior Housemaster',
    description: 'Access denied messages'
  }
];

let totalChanges = 0;
let filesUpdated = 0;

// Process each file
filesToUpdate.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let fileChanges = 0;
    let originalContent = content;

    // Apply all replacements
    replacements.forEach(({ pattern, replacement, description }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        content = content.replace(pattern, replacement);
        fileChanges += matches.length;
        console.log(`  ✓ ${description}: ${matches.length} replacement(s)`);
      }
    });

    // Only write if changes were made
    if (content !== originalContent) {
      // Create backup
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, originalContent, 'utf8');
      
      // Write updated content
      fs.writeFileSync(filePath, content, 'utf8');
      
      console.log(`✅ Updated: ${file} (${fileChanges} changes)`);
      console.log(`   Backup: ${file}.backup\n`);
      
      totalChanges += fileChanges;
      filesUpdated++;
    } else {
      console.log(`⏭️  No changes needed: ${file}\n`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${file}:`, error.message);
  }
});

// Summary
console.log('═══════════════════════════════════════════');
console.log('📊 UPDATE SUMMARY');
console.log('═══════════════════════════════════════════');
console.log(`Files processed: ${filesToUpdate.length}`);
console.log(`Files updated: ${filesUpdated}`);
console.log(`Total changes: ${totalChanges}`);
console.log('═══════════════════════════════════════════\n');

if (filesUpdated > 0) {
  console.log('✅ Backend update complete!');
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Run the SQL script in pgAdmin to update database');
  console.log('2. Update frontend (src/App.jsx)');
  console.log('3. Restart backend server: node server/server.js');
  console.log('4. Test login with: senior.housemaster@ghanasco.edu.gh');
  console.log('\n💡 TIP: Backup files saved with .backup extension');
} else {
  console.log('ℹ️  No updates needed - files already using senior_housemaster');
}
