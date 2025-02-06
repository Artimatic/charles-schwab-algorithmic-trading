import * as configurations from '../../config/environment';

const username = configurations.mongodb.username;
const password = configurations.mongodb.password;

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${username}:${password}@cluster0.uvlrj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

class StrategyDatabaseService {
    dbName = 'stock_portfolio';
    collectionName = 'strategy';
    constructor() { }

    async write(data) {
        try {
            // Connect the client to the server	(optional starting in v4.7)
            await client.connect();

            // Create references to the database and collection in order to run
            // operations on them.
            const database = client.db(this.dbName);
            const collection = database.collection(this.collectionName);

            const document = { $set: { createdAt: new Date(), positions: data } };

            try {
                await collection.insertOne(document); // Insert the document
            } catch (err) {
                console.error(`Something went wrong trying to update one document: ${err}\n`);
            }

        } finally {
            // Ensures that the client will close when you finish/error
            await client.close();
        }
    }

    async deleteOldRecords() {
        try {
            await client.connect();
            const db = client.db(this.dbName);
            const collection = db.collection(this.collectionName);

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2); // Calculate the date 2 days ago

            const filter = { createdAt: { $lt: twoDaysAgo } }; // Filter for records older than 2 days
            // OR, if you are storing dates as strings, you might need:
            // const filter = { createdAt: { $lt: twoDaysAgo.toISOString() } };

            const result = await collection.deleteMany(filter);

            console.log(`Deleted ${result.deletedCount} records.`);
            return result;

        } catch (error) {
            console.error("Error deleting records:", error);
            throw error;
        } finally {
            await client.close();
            console.log("Connection closed.");
        }
    }

    async getRecords(filter = {}, projection = {}) { // Added filter and projection parameters
        try {
            await client.connect();
            const db = client.db(this.dbName);
            const collection = db.collection(this.collectionName);

            const cursor = collection.find(filter, { projection }); // Use find() with filter and projection

            const records = await cursor.toArray(); // Convert the cursor to an array of documents

            console.log(`Found ${records.length} records.`);
            return records;

        } catch (error) {
            console.error("Error getting records:", error);
            throw error;
        } finally {
            await client.close();
            console.log("Connection closed.");
        }
    }

}

export default new StrategyDatabaseService();