/**
 * Standalone script to delete all SnapTrade users
 * Run this directly to clean up all existing SnapTrade users
 */

import * as snapTrade from './lib/snaptrade.js';

async function deleteAllSnapTradeUsers() {
  try {
    console.log('🔍 Fetching all SnapTrade users...');
    
    // Get all users
    const snapUsers = await snapTrade.listAllSnapTradeUsers();
    const users = snapUsers.data || [];
    
    console.log(`📊 Found ${users.length} SnapTrade users to delete:`);
    users.forEach(user => {
      console.log(`  - ${user.userId} (secret: ...${user.userSecret?.slice(-8) || 'N/A'})`);
    });
    
    if (users.length === 0) {
      console.log('✅ No users to delete - you are already cost optimized!');
      return;
    }
    
    // Delete all users
    let deleted = 0;
    let failed = 0;
    const errors = [];
    
    console.log('\n🗑️  Starting bulk deletion...');
    
    for (const user of users) {
      try {
        console.log(`   Deleting user: ${user.userId.slice(-8)}...`);
        await snapTrade.deleteSnapTradeUser(user.userId);
        deleted++;
        console.log(`   ✅ Deleted: ${user.userId.slice(-8)}`);
      } catch (error) {
        failed++;
        const errorMsg = `${user.userId.slice(-8)}: ${error.message}`;
        errors.push(errorMsg);
        console.log(`   ❌ Failed: ${errorMsg}`);
      }
    }
    
    console.log('\n📈 Deletion Summary:');
    console.log(`   Total users processed: ${users.length}`);
    console.log(`   Successfully deleted: ${deleted}`);
    console.log(`   Failed deletions: ${failed}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(error => console.log(`   - ${error}`));
    }
    
    if (deleted > 0) {
      console.log('\n💰 Cost optimization complete! Your SnapTrade costs should be reduced.');
    }
    
  } catch (error) {
    console.error('💥 Fatal error during cleanup:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
console.log('🚀 SnapTrade User Cleanup Tool');
console.log('================================');
deleteAllSnapTradeUsers()
  .then(() => {
    console.log('\n🎉 Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });