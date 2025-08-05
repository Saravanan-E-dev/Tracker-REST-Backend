import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // The name of the counter (e.g., 'userId')
    seq: { type: Number, default: 1000 }  // The starting sequence number (1000 + 1 = 1001)
});

const Counter = mongoose.model('Counter', CounterSchema);

export default Counter;