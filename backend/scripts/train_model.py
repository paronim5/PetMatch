import os
import tensorflow as tf
from tensorflow.keras import layers, models, optimizers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from datetime import datetime

# Configuration
BATCH_SIZE = 32
IMG_HEIGHT = 224
IMG_WIDTH = 224
EPOCHS = 20
LEARNING_RATE = 0.001
DATA_DIR = 'data/dataset'  # Placeholder path

def create_model():
    """
    Builds a CNN model with:
    - Minimum 5 convolutional layers with appropriate pooling
    - Dropout layers for regularization (0.2-0.5 dropout rate)
    - Softmax output layer for multi-class classification
    """
    model = models.Sequential([
        # Layer 1
        layers.Conv2D(32, (3, 3), activation='relu', input_shape=(IMG_HEIGHT, IMG_WIDTH, 3)),
        layers.MaxPooling2D((2, 2)),
        
        # Layer 2
        layers.Conv2D(64, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        
        # Layer 3
        layers.Conv2D(128, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        
        # Layer 4
        layers.Conv2D(256, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        
        # Layer 5
        layers.Conv2D(512, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        
        # Flatten and Dense layers
        layers.Flatten(),
        layers.Dense(512, activation='relu'),
        layers.Dropout(0.5),  # Dropout for regularization
        
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.3),
        
        # Output layer
        # Assuming classes: cat, dog, hamster, bird, fish, rabbit, other (negative)
        layers.Dense(7, activation='softmax')
    ])

    model.compile(optimizer=optimizers.Adam(learning_rate=LEARNING_RATE),
                  loss='categorical_crossentropy',
                  metrics=['accuracy'])
    
    return model

def train():
    """
    Training script placeholder.
    Requires a dataset structure:
    data/dataset/
        train/
            cat/
            dog/
            ...
            negative/
        validation/
            ...
    """
    if not os.path.exists(DATA_DIR):
        print(f"Dataset directory '{DATA_DIR}' not found. Please prepare your dataset.")
        return

    # Data Augmentation
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        fill_mode='nearest'
    )

    val_datagen = ImageDataGenerator(rescale=1./255)

    train_generator = train_datagen.flow_from_directory(
        os.path.join(DATA_DIR, 'train'),
        target_size=(IMG_HEIGHT, IMG_WIDTH),
        batch_size=BATCH_SIZE,
        class_mode='categorical'
    )

    validation_generator = val_datagen.flow_from_directory(
        os.path.join(DATA_DIR, 'validation'),
        target_size=(IMG_HEIGHT, IMG_WIDTH),
        batch_size=BATCH_SIZE,
        class_mode='categorical'
    )

    model = create_model()
    model.summary()

    # Callbacks
    checkpoint_path = "training_checkpoints/cp-{epoch:04d}.ckpt"
    cp_callback = tf.keras.callbacks.ModelCheckpoint(
        filepath=checkpoint_path, 
        save_weights_only=True,
        verbose=1
    )
    
    tensorboard_callback = tf.keras.callbacks.TensorBoard(log_dir="./logs")

    # Train
    history = model.fit(
        train_generator,
        epochs=EPOCHS,
        validation_data=validation_generator,
        callbacks=[cp_callback, tensorboard_callback]
    )

    # Save final model
    model.save('pet_match_model.h5')
    print("Model saved to pet_match_model.h5")

if __name__ == '__main__':
    train()
