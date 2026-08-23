const express = require("express");
const Booking = require("../models/Booking");
const Event = require("../models/Event");

const router = express.Router();

// CREATE BOOKING
router.post("/", async (req, res) => {
    try {
        const { user, event, numberOfSeats } = req.body;

        const selectedEvent = await Event.findById(event);

        if (!selectedEvent) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        if (selectedEvent.availableSeats < numberOfSeats) {
            return res.status(400).json({
                message: "Not enough seats available"
            });
        }

        const totalAmount = selectedEvent.price * numberOfSeats;

        const booking = await Booking.create({
            user,
            event,
            numberOfSeats,
            totalAmount,
            status: "pending"
        });

        selectedEvent.availableSeats -= numberOfSeats;
        await selectedEvent.save();

        const populatedBooking = await Booking.findById(booking._id)
            .populate("user", "name email role")
            .populate("event", "title date time venue price");

        res.status(201).json(populatedBooking);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// GET ALL BOOKINGS
router.get("/", async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate("user", "name email role")
            .populate("event", "title date time venue price");

        res.status(200).json(bookings);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// GET BOOKING BY ID
router.get("/:id", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate("user", "name email role")
            .populate("event", "title date time venue price");

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        res.status(200).json(booking);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// UPDATE BOOKING
router.put("/:id", async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        )
            .populate("user", "name email role")
            .populate("event", "title date time venue price");

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        res.status(200).json(booking);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// DELETE BOOKING
router.delete("/:id", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        // Return seats to the event if booking was not cancelled
        if (booking.status !== "cancelled") {
            await Event.findByIdAndUpdate(
                booking.event,
                {
                    $inc: {
                        availableSeats: booking.numberOfSeats
                    }
                }
            );
        }

        await Booking.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: "Booking deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;