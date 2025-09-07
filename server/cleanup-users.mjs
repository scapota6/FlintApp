import { Snaptrade } from 'snaptrade-typescript-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

const snaptrade = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID,
  consumerKey: process.env.SNAPTRADE_CONSUMER_KEY,
});

async function deleteAllSnapTradeUsers() {
  try {
    console.log('🔍 Fetching all SnapTrade users...');
    
    // Get all users
    const response = await snaptrade.authentication.listSnapTradeUsers();
    const users = response.data || [];
    
    console.log(`📊 Found ${users.length} SnapTrade users to delete:`);
    users.forEach((userId, index) => {
      console.log(`  ${index + 1}. User ID: ${userId}`);
    });
    
    if (users.length === 0) {
      console.log('✅ No users to delete - you are already cost optimized!');
      return;
    }
    
    // Delete all users
    let deleted = 0;
    let failed = 0;
    const errors = [];
    
    console.log('🗑️  Starting bulk deletion...');
    
    for (const userId of users) {
      try {
        console.log(`   Deleting user: ...${userId.slice(-8)}...`);
        await snaptrade.authentication.deleteSnapTradeUser({ 
          userId: userId 
        });
        deleted++;
        console.log(`   ✅ Deleted: ...${userId.slice(-8)}`);
      } catch (error) {
        failed++;
        const errorMsg = `${userId.slice(-8)}: ${error.message || error}`;
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
    
    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    const verifyResponse = await snaptrade.authentication.listSnapTradeUsers();
    const remainingUsers = verifyResponse.data || [];
    console.log(`✅ Remaining users: ${remainingUsers.length}`);
    
  } catch (error) {
    console.error('💥 Fatal error during cleanup:', error.message || error);
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