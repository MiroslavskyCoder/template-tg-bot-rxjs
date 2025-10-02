# RxJS Telegram Bot with Router

This is a simple example of a Telegram bot built with RxJS and a router for handling commands.

The bot listens for incoming messages and passes them through a router, which checks if there is a command handler registered for the command.

If there is a command handler registered, the router executes the handler and passes the result back to the bot, which then sends the result as a message back to the user.

The bot also supports a simple buffer processor, which can be used to buffer incoming messages and then execute a handler on the buffered messages.

The bot is built with the following components:

- `bot.service.ts`: The main service for the bot, which handles incoming messages and passes them through the router.
- `router.ts`: The router for handling commands, which checks if there is a command handler registered for the command.
- `message-handler.ts`: A message handler that listens for incoming messages and passes them through the router.
- `buffer-processor.ts`: A simple buffer processor that can be used to buffer incoming messages and then execute a handler on the buffered messages.

The bot is configured in the `src/index.ts` file, where the bot token and other configuration options can be set.

The bot can be started with the following command:
