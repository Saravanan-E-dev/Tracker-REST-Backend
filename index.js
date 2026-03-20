import dotenv, { decrypt } from 'dotenv';
dotenv.config();
import { randomBytes } from 'crypto';
import express, { response } from 'express';
import mongoose from 'mongoose';
import { createClient } from "redis";
import bcrypt from 'bcryptjs';
import JWT from 'jsonwebtoken';
import getNextSequence from './utils/userIdSequenceGenrator.js';
import auth from './middleware/auth.js';
import checkExternalAuth from './middleware/checkExternalAuth.js';
import cors from 'cors';
import { getBinanceData } from './utils/getBinanceData.js';
import { encrypt } from './utils/encrypt.js';


const redisClient = createClient({
  password: process.env.REDIS_PASSWORD, // Extract this from your URL
  socket: {
    host: process.env.REDIS_URL, // e.g. redis-123.c1.us-east-1.ec2.cloud.redislabs.com
    port: process.env.REDIS_PORT              // e.g. 12345
  }
});

redisClient.on('error', (error) => console.log('Redis Client Error', error));
redisClient.connect();
console.log("Connected to redis cloud")
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT;
// console.log(PORT, MONGO_URI);


//connect to mongodb
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

const app = express();
app.use(express.json());
app.use(cors());

const ExternalExpenseSchema = mongoose.Schema({
  userId: String,
  purpose: String,
  amount: Number, // User's specific share amount
  date: { type: Date, default: Date.now },
  canAdd: { type: Boolean, default: false },
  index: Number
})

const ExpenseDataSchema = mongoose.Schema({
  userId: String,
  amount: Number,
  remark: String,
  spentFromState: String,
  accountId: String,
  date: { type: Date, default: Date.now },
  timestamp: Number
})
const TransactionsSchema = mongoose.Schema({
  userId: String,
  amount: Number,
  remark: String,
  medium: String,
  accountId: String,
  spentFromState: Boolean,
  date: { type: Date, default: Date.now },
  timestamp: Number
});

const SavingsSchema = mongoose.Schema({
  userId: String,
  name: String,
  amount: Number,
  medium: String,
  date: { type: Date, default: Date.now },
  index: Number
});


const BalanceSchema = mongoose.Schema({
  userId: String,
  totalBalance: { type: Number, default: 0 },
  offlineBalance: { type: Number, default: 0 },
  onlineBalances: [{
    id: String,
    name: String,
    amount: Number,
    type: String // general, bank, etc.
  }]
});

// New Digital Accounts Schema
const DigitalAccountsSchema = mongoose.Schema({
  userId: String,
  id: String,
  name: String,
  balance: Number,
  type: String, // bank, card, wallet
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  userId: {
    type: Number,
    unique: true, // Ensure uniqueness
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  walletAuthKey: {
    type: String,
    unique: true,
    default: null,
    sparse: true,
  },
  defaultAccount: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
  },
  binance: {
    apiKey: { type: String, default: null },      
    apiSecret: { type: String, default: null },   
    iv: { type: String, default: null },          // The IV needed for decryption
  },

});

const UserData = mongoose.model('UserData', UserSchema);
const SavingsData = mongoose.model('SavingsData', SavingsSchema);
const BalanceData = mongoose.model('BalanceData', BalanceSchema);
const TransactionsData = mongoose.model('TransactionsData', TransactionsSchema);
const ExpenseData = mongoose.model('ExpenseData', ExpenseDataSchema);
const DigitalAccounts = mongoose.model('DigitalAccounts', DigitalAccountsSchema);
const ExternalExpenseData = mongoose.model('ExternalExpenseData', ExternalExpenseSchema);

app.get('/', (req, res) => {
  res.json({ message: 'working' });
});

//Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const newCustomUserId = await getNextSequence('userId');

    const existingUser = await UserData.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new UserData({
      userId: newCustomUserId,
      username,
      email,
      password: hashedPassword,
    });
    const savedUser = await newUser.save();
    // Generate JWT token
    const token = JWT.sign({ userId: savedUser.userId }, process.env.JWT_SECRET);
    res.status(201).json({
      message: 'User registered successfully',
      token,
      userId: savedUser.userId,
      username: savedUser.username,
      email: savedUser.email
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

//login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Find user by email
    const user = await UserData.findOne({ email });
    if (!user || user.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    // Generate JWT token
    const token = JWT.sign({ userId: user.userId }, process.env.JWT_SECRET);
    res.status(200).json({
      message: 'Login successful',
      token,
      userId: user.userId,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ message: 'Error logging in user' });
  }
});

app.get('/api/get/userdata', auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const userData = await UserData.findOne({ userId: userId.toString() }).select('-password -_id -__v');
    if (!userData) {
      return res.status(404).json({ message: 'User data not found' });
    }
    res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

app.post('/api/generate/authkey', auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const authKey = randomBytes(16).toString('hex');
    const userDataResponse = await UserData.findOneAndUpdate(
      { userId: userId.toString() },
      { $set: { walletAuthKey: authKey } },
      { new: true },
    )
    res.status(200).json({ message: 'Auth API Key Generated Succesfully', AuthKey: userDataResponse.walletAuthKey });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error generating API Auth Key" });
  }
})

app.get('/api/get/authapikey', auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const userDataResponse = await UserData.findOne({ userId: userId });

    if (!userDataResponse || !userDataResponse.walletAuthKey) {
      res.status(200).json({ message: "No Auth Key found for this user" });
    }
    res.status(200).json({ AuthKey: userDataResponse.walletAuthKey });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching API Auth Key" });
  }
})

app.post('/api/send/expenses', checkExternalAuth, async (req, res) => {
  // console.log("1. Route hit!");
  try {
    const UserId = req.userId;
    // let userExpenses = []
    const userExpenses = Array.isArray(req.body) ? req.body : req.body.userSpecificExpenses;
    // console.log(UserId);

    for (const item of userExpenses) {
      let i = await getNextSequence('externalExpense');
      const { purpose, amount, date } = item;
      const ExternalData = new ExternalExpenseData({
        userId: UserId.toString(),
        purpose,
        amount,
        date,
        index: i,
      })

      const savedExternalExpense = await ExternalData.save();
      // console.log("External Expenses saved successfully", savedExternalExpense);
    }
    res.status(200).json({ message: 'External Data added to Temp Database' });
  } catch (error) {
    res.status(500).json({ message: 'Error saving External Data' });
    console.log(error);
  }
})

app.get('/api/get/externalExpenses', auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const externalExpenses = await ExternalExpenseData.find({ userId: userId.toString() }).sort({ date: -1 });
    res.status(200).json(externalExpenses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching External Expenses' });
    console.log(error);
  }
})

app.post('/api/transfer/externaltoexpense', auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const { index } = req.body;
    const deletedData = await ExternalExpenseData.findOneAndDelete({ userId: userId, index: index });

    if (!deletedData) {
      return res.status(404).json({ message: 'Data not found' });
    }

    const saveData = await new ExpenseData({
      userId: userId.toString(),
      amount: deletedData.amount,
      remark: deletedData.purpose,
      spentFromState: "online",
      accountId: UserData.findOne({ userId: userId.toString() }).defaultAccount || null,
    });

    const savedData = await saveData.save();
    res.status(200).json({ message: "Expense data saved succesfully" })

  } catch (error) {
    res.status(500).json({ message: 'error adding the expense' });
    console.log(error);
  }
})

app.delete('/api/delete/externalExpenses', auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const { index } = req.body;
    // console.log(userId,index);
    const deletedData = await ExternalExpenseData.findOneAndDelete({ userId: userId, index: index });

    console.log(deletedData);
    if (!deletedData) {
      return res.status(404).json({ message: 'Data not found' });
    }

    res.status(200).json({ message: 'Removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'could not be deleted' });
    console.log(error);
  }
})

//export function getExpenseData(DataName)
app.get('/api/get/expenses', auth, async (req, res) => {
  try {
    const { userId } = req;
    //find the expense data for the user
    const expenseData = await ExpenseData.find({ userId: userId.toString() });
    if (!expenseData || expenseData.length === 0) {
      return res.status(200).json([]);
    }
    res.status(200).json(expenseData);
  } catch (error) {
    console.error('Error fetching expense data:', error);
    res.status(500).json({ message: 'Error fetching expense data' });
  }
});


//export function setTransactions(DataObject)
app.post('/api/save/transaction', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { amount, remark, medium, accountId, spentFromState, timestamp } = req.body;
    const newTransaction = new TransactionsData({
      userId: userId.toString(),
      amount,
      remark,
      medium,
      accountId,
      spentFromState,
      timestamp
    });
    const savedTransaction = await newTransaction.save();
    res.status(200).json({ message: 'Transaction saved successfully', transaction: savedTransaction });
  } catch (error) {
    console.error('Error saving transactions:', error);
    res.status(500).json({ message: 'Error saving transactions' });
  }
});

//export function getTransactions()
app.get('/api/get/transactions', auth, async (req, res) => {
  try {
    const { userId } = req;
    const transactionsData = await TransactionsData.find({ userId: userId.toString() }).sort({ date: -1 });
    res.status(200).json(transactionsData);
  } catch (error) {
    console.error('Error fetching transactions data:', error);
    res.status(500).json({ message: 'Error fetching transactions data' });
  }
});

//Balance API
//AddOnlineBalance(BalanceData),
//AddOfflineBalance(BalanceData)
app.post('/api/save/balance', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { totalBalance, offlineBalance, onlineBalances } = req.body;

    // update or create balance data
    const existingBalanceData = await BalanceData.findOne({ userId: userId.toString() });
    if (existingBalanceData) {
      existingBalanceData.totalBalance = totalBalance;
      existingBalanceData.offlineBalance = offlineBalance;
      existingBalanceData.onlineBalances = onlineBalances;
      await existingBalanceData.save();
      return res.status(200).json({ message: 'Balance data updated successfully', balance: existingBalanceData });
    }

    const newBalanceData = new BalanceData({
      userId: userId.toString(),
      totalBalance,
      offlineBalance,
      onlineBalances
    });

    const savedBalanceData = await newBalanceData.save();
    res.status(200).json({ message: 'Balance data saved successfully', balance: savedBalanceData });
  } catch (error) {
    console.error('Error saving balance:', error);
    res.status(500).json({ message: 'Error saving balance' });
  }
});


//getTotalBalance()
//getOnlineBalance()
//getOfflineBalance()
app.get('/api/get/balance', auth, async (req, res) => {
  try {
    const { userId } = req;
    const balanceData = await BalanceData.findOne({ userId: userId.toString() });
    if (!balanceData) {
      // Create initial balance structure if not found
      const initialBalance = new BalanceData({
        userId: userId.toString(),
        totalBalance: 0,
        offlineBalance: 0,
        onlineBalances: []
      });
      const savedBalance = await initialBalance.save();
      return res.status(200).json(savedBalance);
    }
    res.status(200).json(balanceData);
  } catch (error) {
    console.error('Error fetching balance data:', error);
    res.status(500).json({ message: 'Error fetching balance data' });
  }
});

//Savings API
//AddSavingsData(savingsData)
app.post('/api/save/savings', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { name, amount, medium } = req.body;
    // const count = await SavingsData.countDocuments({ userId: userId.toString() });
    const i = await getNextSequence('counter');
    const newSavingsData = new SavingsData({
      userId: userId.toString(),
      name,
      amount,
      medium,
      index: i
    });
    const savedSavingsData = await newSavingsData.save();
    res.status(200).json({ message: 'Savings data saved successfully', savings: savedSavingsData });
  } catch (error) {
    console.error('Error saving savings data:', error);
    res.status(500).json({ message: 'Error saving savings data' });
  }
});


app.post('/api/set/binance-api-keys', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { apiKey, apiSecret } = req.body;
    const encryptedKeyData = encrypt(apiKey);
    const encryptedSecretData = encrypt(apiSecret);

    const updatedUser = await UserData.findOneAndUpdate(
      { userId: userId.toString() },
      {
        "binance.apiKey": encryptedKeyData.encryptedData,
        "binance.apiSecret": encryptedSecretData.encryptedData,
        "binance.iv": encryptedKeyData.iv,
    },
    { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'Binance API keys updated successfully' });
  } catch (error) {
    console.error('Error setting Binance API keys:', error);
    res.status(500).json({ message: 'Error setting Binance API keys' });
  }
});


app.post('/api/remove/binance-api-keys', auth, async (req, res) => {
  try {
    const { userId } = req;
    const updatedUser = await UserData.findOneAndUpdate(
      { userId: userId.toString() },
      {
        "binance.apiKey": null,
        "binance.apiSecret": null,
        "binance.iv": null
      },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'Binance API keys removed successfully' });
  } catch (error) {
    console.error('Error removing Binance API keys:', error);
    res.status(500).json({ message: 'Error removing Binance API keys' });
  }
});

app.get('/api/check/binance-keys', auth, async (req, res) => {
  try {
    const { userId } = req;
    const userData = await UserData.findOne({ userId: userId.toString() });
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }
    const hasKeys = userData.binance.apiKey && userData.binance.apiSecret && userData.binance.iv;
    res.status(200).json({ hasKeys: !!hasKeys });
  } catch (error) {
    console.error('Error checking Binance API keys:', error);
    res.status(500).json({ message: 'Error checking Binance API keys' });
  }
});


//get data from binance api
app.get('/api/get/binancedata', auth, async (req, res) => {
  try {
    const { userId } = req;
    const binanceData = await redisClient.get(`binanceData:${userId.toString()}`);
    const binanceKeys = await UserData.findOne({ userId: userId.toString() }).select('binance.apiKey binance.apiSecret binance.iv');
    
    const binanceAPI = decrypt(binanceKeys.binance.apiKey, binanceKeys.binance.iv);
    const binanceSecret = decrypt(binanceKeys.binance.apiSecret, binanceKeys.binance.iv);

    if (!binanceData) {
      const freshData = await getBinanceData(binanceAPI, binanceSecret);
      await redisClient.set(`binanceData:${userId.toString()}`, JSON.stringify(freshData), {
        EX: 300, // Cache for 5 minutes
      });
      return res.status(200).json(freshData);
    }

    res.status(200).json(JSON.parse(binanceData));
  } catch (error) {
    console.error('Error fetching Binance data:', error);
    res.status(500).json({ message: 'Error fetching Binance data' });
  }
});

//getSavingsData()
app.get('/api/get/savings', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { index } = req.query;
    if (!index) {
      const savingsData = await SavingsData.find({ userId: userId.toString() }).sort({ date: -1 });
      // const savingsData = await SavingsData.find({ userId: userId.toString() });
      return res.status(200).json(savingsData);
    }
    const savingsData = await SavingsData.findOne({ userId: userId.toString(), index: parseInt(index) });
    return res.status(200).json(savingsData);
  } catch (error) {
    console.error('Error fetching savings data:', error);
    res.status(500).json({ message: 'Error fetching savings data' });
  }
});

//removeSavingsElement(i)
app.delete('/api/delete/savings', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { index } = req.body;
    const deletedSavingsData = await SavingsData.deleteOne({ userId: userId.toString(), index: parseInt(index) });
    if (deletedSavingsData.deletedCount === 0) {
      return res.status(404).json({ message: 'No savings data found for this user' });
    }
    res.status(200).json({ message: 'Savings data deleted successfully' });
  } catch (error) {
    console.error('Error deleting savings data:', error);
    res.status(500).json({ message: 'Error deleting savings data' });
  }
});

//updateSavingsElement(index,newData)
app.patch('/api/update/savings', auth, async (req, res) => {
  try {
    const { userId } = req;
    console.log(req);
    const { index, name, amount, medium } = req.body;
    const updatedSavingsData = await SavingsData.findOneAndUpdate(
      { userId: userId.toString(), index: parseInt(index) },
      { name, amount, medium },
      { new: true }
    );
    if (!updatedSavingsData) {
      return res.status(404).json({ message: 'Savings data not found' });
    }
    res.status(200).json({ message: 'Savings data updated successfully', savings: updatedSavingsData });
  } catch (error) {
    console.error('Error updating savings data:', error);
    res.status(500).json({ message: 'Error updating savings data' });
  }
});

// Digital Accounts Endpoints
app.post('/api/save/digital-account', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { name, balance, type } = req.body;

    const newAccount = new DigitalAccounts({
      userId: userId.toString(),
      id: Date.now().toString(),
      name,
      balance,
      type
    });

    const savedAccount = await newAccount.save();
    const defaultAccountSet = await UserData.findOneAndUpdate(
      { userId: userId.toString(), defaultAccount: null },
      { defaultAccount: savedAccount.id },
      { new: true }
    );

    res.status(200).json({ message: 'Digital account saved successfully', account: savedAccount });
  } catch (error) {
    console.error('Error saving digital account:', error);
    res.status(500).json({ message: 'Error saving digital account' });
  }
});

app.get('/api/get/digital-accounts', auth, async (req, res) => {
  try {
    const { userId } = req;
    const accounts = await DigitalAccounts.find({ userId: userId.toString() }).sort({ createdAt: -1 });
    res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching digital accounts:', error);
    res.status(500).json({ message: 'Error fetching digital accounts' });
  }
});

app.put('/api/update/digital-account/:accountId', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { accountId } = req.params;
    const updates = req.body;

    const updatedAccount = await DigitalAccounts.findOneAndUpdate(
      { userId: userId.toString(), id: accountId },
      updates,
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({ message: 'Account not found' });
    }

    res.status(200).json({ message: 'Account updated successfully', account: updatedAccount });
  } catch (error) {
    console.error('Error updating digital account:', error);
    res.status(500).json({ message: 'Error updating digital account' });
  }
});

app.delete('/api/delete/digital-account/:accountId', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { accountId } = req.params;

    const defaultAccountCheck = await UserData.findOne({ userId: userId.toString(), defaultAccount: accountId });
    if (defaultAccountCheck) {
      await UserData.findOneAndUpdate(
        { userId: userId.toString() },
        { $set: { defaultAccount: null } }
      );
    }

    const deletedAccount = await DigitalAccounts.findOneAndDelete({
      userId: userId.toString(),
      id: accountId
    });

    const defaultAccountSet = await UserData.findOneAndUpdate(
      { userId: userId.toString(), defaultAccount: null },
      { defaultAccount: await DigitalAccounts.findOne({ userId: userId.toString() }).sort({ createdAt: -1 }).select('id') },
      { new: true }
    );

    if (!deletedAccount) {
      return res.status(404).json({ message: 'Account not found' });
    }

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting digital account:', error);
    res.status(500).json({ message: 'Error deleting digital account' });
  }
});

// Add expense endpoint
app.post('/api/save/expense', auth, async (req, res) => {
  try {
    const { userId } = req;
    const { amount, remark, spentFromState, accountId } = req.body;

    const newExpense = new ExpenseData({
      userId: userId.toString(),
      amount,
      remark,
      spentFromState,
      accountId,
      timestamp: Date.now()
    });

    const savedExpense = await newExpense.save();
    res.status(200).json({ message: 'Expense saved successfully', expense: savedExpense });
  } catch (error) {
    console.error('Error saving expense:', error);
    res.status(500).json({ message: 'Error saving expense' });
  }
});

//start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

