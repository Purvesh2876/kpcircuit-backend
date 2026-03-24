const mongoose = require('mongoose');

/**
 * Executes a callback within a managed transaction if supported by the MongoDB deployment.
 * Falls back to a non-transactional execution if transactions are not available.
 * 
 * @param {Function} callback - The async function to execute. Receives the session object as an argument.
 * @returns {Promise<any>} - The result of the callback.
 */
const runInTransaction = async (callback) => {
    let session = null;
    
    try {
        // Attempt to start a session
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (error) {
        // If session/transaction is not supported, we proceed without it
        // The error code for no replica set is usually 20 or contains a specific message
        if (error.code === 20 || error.message.includes('replica set') || error.message.includes('Transaction numbers')) {
            session = null;
        } else {
            throw error; // Rethrow other unexpected errors
        }
    }

    try {
        const result = await callback(session);
        
        if (session) {
            await session.commitTransaction();
            session.endSession();
        }
        
        return result;
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        throw error;
    }
};

module.exports = { runInTransaction };
