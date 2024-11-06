from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # To allow requests from your frontend

orders = {}
order_id_counter = 1

@app.route('/api/orders', methods=['POST'])
def create_order():
    global order_id_counter
    data = request.json
    order_id = order_id_counter
    orders[order_id] = {
        'items': data['items'],
        'totalCost': data['totalCost']
    }
    order_id_counter += 1
    return jsonify({'order_id': order_id})

@app.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order(order_id):
    order = orders.get(order_id)
    if order:
        return jsonify(order)
    else:
        return jsonify({'error': 'Order not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)
