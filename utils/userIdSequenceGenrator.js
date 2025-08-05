import Counter from '../models/counter.js';

async function getNextSequence(name) {
    // findOneAndUpdate is atomic, preventing race conditions
    const counter = await Counter.findOneAndUpdate(
        { _id: name }, // Find the counter document by its name
        { $inc: { seq: 1001 } }, // Increment the 'seq' field by 1
        { new: true, upsert: true } // Return the updated document, create if it doesn't exist
    );
    return counter.seq;
}

export default getNextSequence;
