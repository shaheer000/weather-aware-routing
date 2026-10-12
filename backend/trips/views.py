import logging

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from trips.clients.http import ProviderError
from trips.planner import TripRequest, plan_trip
from trips.serializers import TripRequestSerializer

logger = logging.getLogger(__name__)


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["POST"])
def plan(request):
    serializer = TripRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        trip_plan = plan_trip(TripRequest(**serializer.validated_data))
    except ProviderError as error:
        return _bad_gateway(error)
    return Response(trip_plan)


def _bad_gateway(error):
    logger.warning("Upstream provider failed: %s", error)
    return Response(
        {"detail": str(error)}, status=status.HTTP_502_BAD_GATEWAY
    )
