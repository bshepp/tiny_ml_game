# 🗿📄✂️ Rock Paper Scissors - AI ML Game

A sophisticated Rock Paper Scissors game featuring AI opponents powered by TensorFlow.js machine learning. Play against an AI that learns your patterns and adapts its strategy!

## ✨ Features

### 🤖 AI Strategies
- **Random**: Completely unpredictable moves
- **Counter**: Analyzes your last move and counters it
- **Pattern**: Detects patterns in your recent gameplay  
- **Learning**: Advanced neural network that learns your playing style over time

### 🧠 Machine Learning
- **TensorFlow.js Integration**: Real-time neural network training in the browser
- **Sequence Analysis**: AI analyzes your move patterns using the last 5 games
- **Advanced Model Architecture**: Multi-layer neural network with dropout regularization
- **Real-time Training**: Model continuously improves as you play
- **Model Accuracy Tracking**: See how well the AI is learning your patterns

### 🎨 Modern UI/UX
- **Tailwind CSS**: Beautiful, responsive design
- **Loading States**: Smooth user experience with proper loading indicators
- **Error Handling**: Graceful fallbacks when ML model fails
- **Animated Elements**: Hover effects and smooth transitions
- **Mobile-Friendly**: Fully responsive design

### 📊 Game Analytics
- **Statistics Tracking**: Wins, losses, ties, and win rate
- **Game History**: View your recent matches with timestamps
- **Data Persistence**: Game data saved locally using localStorage
- **Performance Metrics**: Track AI model accuracy and training progress

## 🚀 Getting Started

### Prerequisites
- Node.js 22.x (LTS)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd tiny-ml-game

# Install dependencies
npm install

# Start the development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to play the game!

## 🔧 Technology Stack

- **Frontend**: React 19.1.1 with modern hooks
- **ML Framework**: TensorFlow.js 4.22.0
- **Styling**: Tailwind CSS 4.x
- **Build Tools**: React Scripts 5.0.1
- **Testing**: Jest & React Testing Library
- **State Management**: React Hooks with custom storage hook

## 🧪 Testing

```bash
# Run tests
npm test

# Build for production
npm run build
```

## 🏗️ Architecture

### Neural Network Model
The AI uses a sophisticated neural network architecture:

- **Input Layer**: Sequence of last 5 moves (15 features)
- **Hidden Layers**: 
  - Dense(128) with ReLU + Dropout(0.3) + L2 regularization
  - Dense(64) with ReLU + Dropout(0.2) + L2 regularization  
  - Dense(32) with ReLU
- **Output Layer**: Dense(3) with softmax (Rock/Paper/Scissors probabilities)

### Training Process
- **Real-time Learning**: Model trains after each game when using "Learning" strategy
- **Batch Training**: Uses recent game history for training data
- **Regularization**: Prevents overfitting with dropout and L2 regularization
- **Validation**: Includes validation split to monitor training progress

### Error Handling
- **Graceful Degradation**: Falls back to basic strategies if ML model fails
- **Loading States**: Shows initialization progress
- **Error Messages**: Clear user feedback for issues
- **Memory Management**: Proper tensor disposal to prevent memory leaks

## 🎯 Game Mechanics

1. **Choose Your Move**: Click Rock, Paper, or Scissors
2. **AI Responds**: Based on selected strategy, AI makes its move
3. **Results**: Winner determined by classic Rock Paper Scissors rules
4. **Learning**: In Learning mode, AI trains on your move patterns
5. **Statistics**: Track your performance over time

## 📈 Recent Updates

### Security & Performance
- ✅ Updated from react-scripts 3.4.4 → 5.0.1 (fixed 162 vulnerabilities)
- ✅ Updated React to 19.1.1 (latest stable)
- ✅ Updated all testing libraries to latest versions
- ✅ Added Tailwind CSS for modern styling

### Features Added
- ✅ Advanced neural network architecture with proper regularization
- ✅ Real-time model training and accuracy tracking
- ✅ Game data persistence with localStorage
- ✅ Comprehensive error handling and loading states
- ✅ Pattern recognition AI strategy
- ✅ Mobile-responsive design
- ✅ Game history with timestamps
- ✅ Progressive Web App (PWA) ready

### Code Quality
- ✅ Modern React hooks (useCallback, useMemo, custom hooks)
- ✅ Proper memory management for TensorFlow tensors
- ✅ TypeScript-ready codebase
- ✅ Comprehensive error boundaries
- ✅ Performance optimizations

## 📋 Development Documentation

For developers working with this codebase, see [`CLAUDE.md`](./CLAUDE.md) for comprehensive development guidance including:
- Architecture overview and component structure
- TensorFlow.js integration details and neural network architecture
- Development patterns and best practices
- Testing considerations and limitations
- Memory management for ML operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎮 Play Strategy Tips

- **Against Random**: Pure luck - no strategy needed!
- **Against Counter**: Mix up your moves, avoid repetitive patterns
- **Against Pattern**: Be unpredictable, change your strategy frequently  
- **Against Learning**: The longer you play, the better it gets at predicting you!

---

Built with ❤️ using React, TensorFlow.js, and modern web technologies.