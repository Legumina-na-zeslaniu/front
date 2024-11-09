import { createApp, h, provide } from 'vue'
import './style.css'
import App from './App.vue';
import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { DefaultApolloClient } from '@vue/apollo-composable';

// HTTP connection to the API
const httpLink = createHttpLink({
  // You should use an absolute URL here
  uri: import.meta.env.VITE_GRAPHQL_URI,
})

// Cache implementation
const cache = new InMemoryCache()

// Create the apollo client
const apolloClient = new ApolloClient({
  link: httpLink,
  cache,
})

const app = createApp({
  setup() {
    provide(DefaultApolloClient, apolloClient)
  },

  render: () => h(App),
})

app.mount('#app')
