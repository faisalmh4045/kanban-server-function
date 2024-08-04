import { Client, Databases, Query, Users, Storage } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const users = new Users(client);
const storage = new Storage(client);

const reassignTodoOrder = async (userId) => {
  // fetch all todos matching userId
  const todos = await databases.listDocuments(
    process.env.APPWRITE_DATABASE_ID,
    process.env.APPWRITE_COLLECTION_ID,
    [Query.equal('userId', userId), Query.orderAsc('order')]
  );

  const statusCategories = {
    todo: [],
    doing: [],
    review: [],
    completed: [],
  };

  // categorize todos by status
  todos.documents.forEach((todo) => {
    if (todo.status.toLowerCase() in statusCategories) {
      statusCategories[todo.status.toLowerCase()].push(todo);
    }
  });

  // update todo order field based on offset value
  const updateOrder = (todos, offset = 100) => {
    return todos.map((todo, index) => {
      todo.order = (index + 1) * offset;
      return todo;
    });
  };

  // update todo order for each category
  statusCategories.todo = updateOrder(statusCategories.todo);
  statusCategories.doing = updateOrder(statusCategories.doing);
  statusCategories.review = updateOrder(statusCategories.review);
  statusCategories.completed = updateOrder(statusCategories.completed);

  // flatten the updated todos array
  const updatedTodos = [
    ...statusCategories.todo,
    ...statusCategories.doing,
    ...statusCategories.review,
    ...statusCategories.completed,
  ];

  // array to store the latest updated todos
  const latestUpdatedTodos = [];

  // update each todo in the database
  for (const todo of updatedTodos) {
    const document = await databases.updateDocument(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_COLLECTION_ID,
      todo.$id,
      {
        order: todo.order,
      }
    );
    latestUpdatedTodos.push(document);
  }

  return latestUpdatedTodos;
};

const deleteUser = async (userId) => {
  // get the user
  const user = await users.get(userId);

  // delete the avatar if it exists
  if (user.prefs && user.prefs.avatar) {
    await storage.deleteFile(process.env.APPWRITE_BUCKET_ID, user.prefs.avatar);
  }

  // fetch all todos matching userId
  const todos = await databases.listDocuments(
    process.env.APPWRITE_DATABASE_ID,
    process.env.APPWRITE_COLLECTION_ID,
    [Query.equal('userId', userId)]
  );

  // delete all the todos
  for (const todo of todos.documents) {
    await databases.deleteDocument(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_COLLECTION_ID,
      todo.$id
    );
  }

  // delete the user
  await users.delete(userId);
};

export default async ({ req, res }) => {
  if (req.method === 'GET') {
    const { action, userId } = req.query;
    try {
      if (action === 'reassignOrder') {
        const updatedTodos = await reassignTodoOrder(userId);
        return res.json({
          success: true,
          message: 'Order fields updated successfully',
          updatedTodos: updatedTodos,
        });
      } else if (action === 'deleteUser') {
        await deleteUser(userId);
        return res.json({
          success: true,
          message: 'User deleted successfully',
        });
      }
    } catch (error) {
      return res.json({
        success: false,
        message: `Failed to ${
          action === 'deleteUser' ? 'delete user' : 'reassign order'
        }`,
        error: error.message,
      });
    }
  }
};
