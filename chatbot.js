const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');

// Menu with prices
const menu = {
    'Pizza': 10,
    'Pasta': 8,
    'Salad': 7,
    'Samosa': 2,
    'Custard': 15,
};

// Responses for the chatbot
const responses = {
    greeting: "Hello! Welcome to our restaurant. How can I help you today? You can say 'Menu' or 'Order Now'.",
    menu: () => `Here is our menu: ${Object.entries(menu).map(([item, price]) => `${item} - $${price}`).join(', ')}.`,
    exampleOrder: "For example, you can say 'Add 2 Pizza' or 'I would like to add 2 Pizza'.",
    askForOrder: "Please provide your order by typing the name of the items and their quantities.",
    orderReceived: "Thank you for your order! Your total cost is: ",
    trackOrder: "You can track your order using the tracking number: ",
    repeatOrder: "You have ordered: ",
    askForMore: "Is there anything else you would like to order? (Type 'no' to finalize your order)",
    itemRemoved: (item, totalCost) => `Ok, your ${item} is removed from the bill. Your new total cost is: $${totalCost}.`,
    orderComplete: "Your final order is: ",
    trackConfirmation: "Would you like to track your order? (Type 'yes' to track or 'no' to finalize your order)",
    requestTrackingNumber: "Please provide your tracking number.",
    orderFinalized: "Thank you for your order. Your final order is: ",
    notInMenu: "Please choose from our menu.",
    thanks: "Thanks for coming here! If you need anything else, feel free to ask.",
    error: "I didn't understand that. Please type 'Menu' or 'Order Now'."
};

// Mapping of fuzzy synonyms to standard menu items
const synonymMap = {
    'pizza': 'Pizza',
    'pasta': 'Pasta',
    'salad': 'Salad',
    'samosa': 'Samosa',
    'custard': 'Custard'
};

// Mapping of written numbers to integers
const numberMap = {
    'one': 1,
    'two': 2,
    'three': 3,
    'four': 4,
    'five': 5,
    'six': 6,
    'seven': 7,
    'eight': 8,
    'nine': 9,
    'ten': 10
};

// Track orders
let orderNumber = 1;
let orders = {};  // Store all orders
let currentOrder = {};
let awaitingAdditionalOrder = false;
let awaitingTrackConfirmation = false;
let awaitingTrackingNumber = false;
let hasFinalizedOrder = false;

// Load data from local storage
function loadFromLocalStorage() {
    const storedOrders = localStorage.getItem('orders');
    const storedOrderNumber = localStorage.getItem('orderNumber');
    
    if (storedOrders) {
        orders = JSON.parse(storedOrders);
    }

    if (storedOrderNumber) {
        orderNumber = parseInt(storedOrderNumber, 10);
    }
}

// Save data to local storage
function saveToLocalStorage() {
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('orderNumber', orderNumber);
}

// Function to add a message to the chatbox
function addMessage(content, sender) {
    const message = document.createElement('div');
    message.classList.add('message');
    message.classList.add(sender);
    message.textContent = content;
    chatbox.appendChild(message);
    chatbox.scrollTop = chatbox.scrollHeight; // Scroll to the bottom
}

// Function to display the menu
function displayMenu() {
    addMessage(responses.menu(), 'bot');
    addMessage(responses.exampleOrder, 'bot');
}

// Function to normalize user input to standard menu items
function normalizeInput(userInput) {
    const lowerInput = userInput.toLowerCase().trim();
    return synonymMap[lowerInput] || Object.keys(synonymMap).find(key => lowerInput.includes(key)) || lowerInput;
}

// Function to convert written numbers to integers
function convertNumberWordToInt(word) {
    return numberMap[word] || parseInt(word, 10);
}

// Function to extract items and quantities from user input
function extractOrderDetails(userInput) {
    const orderDetails = {};
    
    // Regular expression to match quantities and items
    const regex = /(\d+)\s+(\w+)/g;
    let match;
    while ((match = regex.exec(userInput)) !== null) {
        const quantity = parseInt(match[1], 10);
        const item = synonymMap[match[2].toLowerCase()] || normalizeInput(match[2]);
        if (menu[item]) {
            orderDetails[item] = (orderDetails[item] || 0) + quantity;
        }
    }

    return orderDetails;
}

// Function to update and display the current order summary
function updateOrderSummary() {
    const totalCost = Object.entries(currentOrder)
        .reduce((total, [item, qty]) => total + menu[item] * qty, 0);
    const orderDetails = Object.entries(currentOrder)
        .map(([item, qty]) => `${item} (x${qty})`)
        .join(', ');
    addMessage(`You have ordered: ${orderDetails}`, 'bot');
    addMessage(`Your total cost for the selected items is: $${totalCost}.`, 'bot');
}

// Function to handle user input
function handleUserInput(userInput) {
    const lowerInput = userInput.toLowerCase().trim();

    // Display user message
    addMessage(userInput, 'user');

    if (awaitingTrackConfirmation) {
        if (lowerInput === 'yes') {
            addMessage(responses.requestTrackingNumber, 'bot');
            awaitingTrackConfirmation = false;
            awaitingTrackingNumber = true;
        } else if (lowerInput === 'no') {
            addMessage("Thank you for your order! If you need any more assistance, feel free to ask.", 'bot');
            awaitingTrackConfirmation = false;
            hasFinalizedOrder = false; // Reset flag since order is no longer active
        } else {
            addMessage("Please type 'yes' or 'no'.", 'bot');
        }
        return;
    }
    
    if (awaitingTrackingNumber) {
        const trackingNumber = userInput.trim();
        fetch(`http://127.0.0.1:5000/api/orders/${trackingNumber}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    addMessage("Sorry, I couldn't find that tracking number.", 'bot');
                } else {
                    addMessage(`Your order is: ${Object.entries(data.items)
                        .map(([item, qty]) => `${item} (x${qty})`)
                        .join(', ')}`, 'bot');
                    addMessage(`Your total cost is: $${data.totalCost}.`, 'bot');
                }
                awaitingTrackingNumber = false;
            })
            .catch(error => {
                console.error('Error:', error);
                addMessage('Failed to retrieve the order. Please try again later.', 'bot');
                awaitingTrackingNumber = false;
            });
        return;
    }

    if (awaitingAdditionalOrder) {
        if (lowerInput === 'no' || lowerInput === 'nope' || lowerInput === 'nothing else' || lowerInput === 'done') {
            finalizeOrder();
        } else if (lowerInput.startsWith('remove')) {
            const itemToRemove = lowerInput.replace(/^remove\s+/i, '').trim();
            const normalizedItem = normalizeInput(itemToRemove);
            removeItemFromOrder(normalizedItem);
        } else {
            const extractedOrder = extractOrderDetails(userInput);
            if (Object.keys(extractedOrder).length > 0) {
                Object.entries(extractedOrder).forEach(([item, qty]) => {
                    if (menu[item]) {
                        currentOrder[item] = (currentOrder[item] || 0) + qty; // Increment quantity if item already exists
                    } else {
                        addMessage(responses.notInMenu, 'bot');
                        displayMenu(); // Show the menu again
                    }
                });
                updateOrderSummary();
                addMessage(responses.askForMore, 'bot');
            } else {
                addMessage("Please specify the items and their quantities.", 'bot');
            }
        }
        return;
    }

    if (lowerInput.includes('menu') || lowerInput.includes('order now')) {
        displayMenu();
        return;
    }

    if (lowerInput.includes('track')) {
        if (hasFinalizedOrder) {
            addMessage(responses.trackConfirmation, 'bot');
            awaitingTrackConfirmation = true;
        } else {
            addMessage("You need to finalize your order before tracking it.", 'bot');
        }
        return;
    }

    if (lowerInput.includes('remove')) {
        const itemToRemove = lowerInput.replace(/^remove\s+/i, '').trim();
        const normalizedItem = normalizeInput(itemToRemove);
        removeItemFromOrder(normalizedItem);
        return;
    }

    if (lowerInput.includes('order') || lowerInput.includes('add')) {
        const extractedOrder = extractOrderDetails(userInput);
        if (Object.keys(extractedOrder).length > 0) {
            Object.entries(extractedOrder).forEach(([item, qty]) => {
                if (menu[item]) {
                    currentOrder[item] = (currentOrder[item] || 0) + qty; // Increment quantity if item already exists
                } else {
                    addMessage(responses.notInMenu, 'bot');
                    displayMenu(); // Show the menu again
                }
            });
            updateOrderSummary();
            addMessage(responses.askForMore, 'bot');
            awaitingAdditionalOrder = true; // Set flag to wait for additional orders
        } else {
            addMessage("Please specify the items and their quantities.", 'bot');
        }
        return;
    }

    if (lowerInput === 'no' || lowerInput === 'nope' || lowerInput === 'nothing else' || lowerInput === 'done') {
        finalizeOrder();
        return;
    }

    if (lowerInput === 'thanks' || lowerInput === 'thank you') {
        addMessage(responses.thanks, 'bot');
        resetConversation(); // Reset conversation state
        return;
    }

    addMessage(responses.error, 'bot');
}

// Function to finalize the order
function finalizeOrder() {
    if (!hasFinalizedOrder) {
        hasFinalizedOrder = true;
        const totalCost = Object.entries(currentOrder)
            .reduce((total, [item, qty]) => total + menu[item] * qty, 0);
        const orderDetails = Object.entries(currentOrder)
            .map(([item, qty]) => `${item} (x${qty})`)
            .join(', ');

        fetch('http://127.0.0.1:5000/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: currentOrder,
                totalCost
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                addMessage('Failed to finalize the order: ' + data.error, 'bot');
                console.error('Error:', data.error);
            } else {
                addMessage(`${responses.orderComplete} ${orderDetails}`, 'bot');
                addMessage(`Your total cost is: $${totalCost}.`, 'bot');
                addMessage(`${responses.trackOrder} ${data.order_id}.`, 'bot');
                currentOrder = {}; // Clear current order
                awaitingAdditionalOrder = false; // Reset flag
                awaitingTrackConfirmation = false; // Reset flag
                orderNumber = data.order_id + 1; // Update order number for the next order
            }
        })
        .catch(error => {
            console.error('Error:', error);
            addMessage('Failed to finalize the order. Please try again later.', 'bot');
        });
    } else {
        addMessage("Your order has already been finalized.", 'bot');
    }
}

// Function to remove an item from the current order
function removeItemFromOrder(item) {
    if (currentOrder[item]) {
        delete currentOrder[item];
        updateOrderSummary();
    } else {
        addMessage("Item not found in the order.", 'bot');
    }
}

// Function to reset conversation state
function resetConversation() {
    currentOrder = {};
    awaitingAdditionalOrder = false;
    awaitingTrackConfirmation = false;
    awaitingTrackingNumber = false;
    hasFinalizedOrder = false;
}

// Event listener for user input
input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const userInput = input.value.trim();
        input.value = ''; // Clear the input field
        handleUserInput(userInput);
    }
});

// Initialize
loadFromLocalStorage();
addMessage(responses.greeting, 'bot');
