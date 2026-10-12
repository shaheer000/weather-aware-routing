from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from trips.checkpoints import CHECKPOINT_INTERVALS_MI
from trips.geo import Coordinate, Place

MAX_DAYS_AHEAD = 7
MAX_LOAD_LB = 80_000


class PlaceSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=300)
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        return Place(
            name=values["name"],
            coordinate=Coordinate(lat=values["lat"], lon=values["lon"]),
        )


class TripRequestSerializer(serializers.Serializer):
    origin = PlaceSerializer()
    destination = PlaceSerializer()
    departure_time = serializers.DateTimeField()
    load_lb = serializers.IntegerField(min_value=0, max_value=MAX_LOAD_LB)
    checkpoint_interval_miles = serializers.ChoiceField(
        choices=CHECKPOINT_INTERVALS_MI
    )

    def validate_departure_time(self, value):
        now = timezone.now()
        if value < now - timedelta(hours=1):
            raise serializers.ValidationError(
                "Departure must be in the future."
            )
        if value > now + timedelta(days=MAX_DAYS_AHEAD):
            raise serializers.ValidationError(
                f"Forecasts reach only {MAX_DAYS_AHEAD} days ahead."
            )
        return value

    def validate(self, attrs):
        if attrs["origin"].coordinate == attrs["destination"].coordinate:
            raise serializers.ValidationError(
                "Origin and destination must be different places."
            )
        return attrs
